import React, { useState } from 'react';
import { Server, Check, X, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { getBackendUrl, setBackendUrl } from '../services/socket';

export function BackendModal({ isOpen, onClose, onReconnected }) {
  const [url, setUrl] = useState(() => getBackendUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const cleanUrl = url.trim().replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        setTestResult({ success: true, message: `Connected! Server status: ${data.status}` });
      } else {
        setTestResult({ success: false, message: `Server responded with HTTP ${res.status}` });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `Failed to reach server: ${err.message}. Ensure CORS allows this origin and server is running.`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const cleanUrl = url.trim().replace(/\/$/, '');
    setBackendUrl(cleanUrl);
    if (onReconnected) onReconnected(cleanUrl);
    onClose();
  };

  const handleResetToDefault = () => {
    setBackendUrl('');
    setUrl(getBackendUrl());
    if (onReconnected) onReconnected(getBackendUrl());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Backend Server URL</h3>
            <p className="text-xs text-slate-400">Configure WebSocket & API endpoint for real-time collaboration</p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/50 text-xs text-blue-300 leading-relaxed">
            <p className="font-semibold mb-1">💡 Notice for Vercel Deployments:</p>
            Vercel hosts the frontend static files. WebSockets require a persistent Node.js server (e.g. hosted on Render, Railway, or local machine).
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
              Backend Server URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. https://whiteboard-backend.onrender.com or http://localhost:5000"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-blue-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/50 border border-rose-800 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleTestConnection}
              disabled={testing || !url.trim()}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button
              onClick={handleResetToDefault}
              className="px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs transition-colors"
            >
              Reset to Default
            </button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/30"
          >
            Save & Reconnect
          </button>
        </div>
      </div>
    </div>
  );
}
