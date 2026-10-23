import { useCallback, useEffect, useReducer, useRef } from 'react';

import { getErrors, processBatch } from '../services/api.js';

const INITIAL_STATE = {
  status: 'idle',
  runId: null,
  total: 0,
  processed: 0,
  currentFile: '',
  errors: [],
  errorMessage: '',
};

const TERMINAL_STATUSES = new Set(['done', 'failed']);

function reducer(state, action) {
  switch (action.type) {
    case 'start':
      return { ...INITIAL_STATE, status: 'running', runId: action.runId };
    case 'started':
      return { ...state, total: action.total ?? state.total };
    case 'progress':
      return {
        ...state,
        processed: action.processed ?? state.processed,
        total: action.total ?? state.total,
        currentFile: action.file ?? state.currentFile,
      };
    case 'error':
      return { ...state, errors: [...state.errors, action.error] };
    case 'done':
      return {
        ...state,
        status: 'done',
        processed: action.processed ?? state.processed,
        total: action.total ?? state.total,
        currentFile: '',
        errors: Array.isArray(action.errors) ? action.errors : state.errors,
      };
    case 'errors-synced':
      return { ...state, errors: action.errors };
    case 'connection-lost':
      if (state.status !== 'running') return state;
      return { ...state, status: 'connection-lost' };
    case 'failed':
      if (TERMINAL_STATUSES.has(state.status)) return state;
      return { ...state, status: 'failed', errorMessage: action.message };
    case 'reset':
      return INITIAL_STATE;
    default:
      return state;
  }
}

function streamUrl(runId) {
  const { protocol, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}/ws?runId=${encodeURIComponent(runId)}`;
}

function parseMessage(event) {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

export default function useRunStream() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const socketRef = useRef(null);
  const activeRunRef = useRef(null);

  const closeSocket = useCallback(() => {
    activeRunRef.current = null;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) socket.close();
  }, []);

  useEffect(() => closeSocket, [closeSocket]);

  const syncErrors = useCallback(async (runId) => {
    try {
      const errors = await getErrors(runId);
      dispatch({ type: 'errors-synced', errors });
    } catch {
      // The stream already rendered whatever it observed; keep that list.
    }
  }, []);

  const handleMessage = useCallback(
    (message) => {
      if (!message || typeof message.type !== 'string') return;

      switch (message.type) {
        case 'started':
          dispatch({ type: 'started', total: message.total });
          break;
        case 'progress':
          dispatch({
            type: 'progress',
            processed: message.processed,
            total: message.total,
            file: message.file,
          });
          break;
        case 'error':
          dispatch({
            type: 'error',
            error: message.error ?? {
              code: 'UNKNOWN',
              file: message.file,
              stage: 'unknown',
              message: message.message,
              timestamp: new Date().toISOString(),
            },
          });
          break;
        case 'done':
          dispatch({
            type: 'done',
            total: message.total,
            processed: message.processed,
            errors: message.errors,
          });
          if (activeRunRef.current) syncErrors(activeRunRef.current);
          break;
        default:
          break;
      }
    },
    [syncErrors],
  );

  const start = useCallback(
    async (config) => {
      closeSocket();

      const runId = crypto.randomUUID();
      activeRunRef.current = runId;
      dispatch({ type: 'start', runId });

      const socket = new WebSocket(streamUrl(runId));
      socketRef.current = socket;

      socket.addEventListener('message', (event) => {
        if (activeRunRef.current !== runId) return;
        handleMessage(parseMessage(event));
      });
      socket.addEventListener('close', () => {
        if (activeRunRef.current !== runId) return;
        dispatch({ type: 'connection-lost' });
      });

      try {
        await processBatch({ ...config, runId });
      } catch (error) {
        if (activeRunRef.current !== runId) return;
        activeRunRef.current = null;
        dispatch({ type: 'failed', message: error.message });
        socketRef.current = null;
        socket.close();
      }

      return runId;
    },
    [closeSocket, handleMessage],
  );

  const reset = useCallback(() => {
    closeSocket();
    dispatch({ type: 'reset' });
  }, [closeSocket]);

  return { ...state, start, reset };
}
