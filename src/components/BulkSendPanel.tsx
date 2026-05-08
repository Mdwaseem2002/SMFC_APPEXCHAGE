'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: Array<{
    type: string;
    text?: string;
  }>;
}

interface BulkResult {
  phone: string;
  wamid: string | null;
  success: boolean;
  error?: string;
}

interface BulkSendPanelProps {
  preSelectedTemplate?: Template | null;
}

const BulkSendPanel: React.FC<BulkSendPanelProps> = ({ preSelectedTemplate }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [language, setLanguage] = useState('en');
  const [parameters, setParameters] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [results, setResults] = useState<{
    total: number;
    success: number;
    failed: number;
    results: BulkResult[];
  } | null>(null);
  const [showFailed, setShowFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates for dropdown
  useEffect(() => {
    const fetchTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const response = await fetch('/api/templates');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.templates)) {
            setTemplates(data.templates);
          }
        }
      } catch (err) {
        console.error('Error fetching templates:', err);
      } finally {
        setTemplatesLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  // Pre-select template when passed as prop
  useEffect(() => {
    if (preSelectedTemplate) {
      setSelectedTemplateName(preSelectedTemplate.name);
      if (preSelectedTemplate.language) {
        setLanguage(preSelectedTemplate.language);
      }
    }
  }, [preSelectedTemplate]);

  const phoneNumberList = phoneNumbers
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const phoneCount = phoneNumberList.length;
  const isOverLimit = phoneCount > 50;

  const handleSend = async () => {
    if (!selectedTemplateName || phoneCount === 0) return;
    if (isOverLimit) return;

    setLoading(true);
    setResults(null);
    setError(null);

    const paramArray = parameters
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const contacts = phoneNumberList.map(phone => ({
      phone,
      templateName: selectedTemplateName,
      language,
      parameters: paramArray.length > 0 ? paramArray : undefined,
      headerImageUrl: headerImageUrl.trim() ? headerImageUrl.trim() : undefined,
    }));

    try {
      const response = await fetch('/api/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error('Bulk send error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send messages');
    } finally {
      setLoading(false);
    }
  };

  const failedResults = results?.results.filter(r => !r.success) || [];

  const inputStyle: React.CSSProperties = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#0f172a',
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#ffffff' }}>
      {/* Header */}
      <div className="sticky top-0 p-3.5 border-b z-10" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderColor: '#e2e8f0' }}>
        <h2 className="text-[15px] font-semibold tracking-wide flex items-center gap-2" style={{ color: '#0f172a' }}>
          <span>📢</span> Bulk Send
        </h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Template Dropdown */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748b' }}>
            Select Template <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            value={selectedTemplateName}
            onChange={(e) => setSelectedTemplateName(e.target.value)}
            className="w-full p-2.5 rounded-xl text-sm focus:outline-none appearance-none cursor-pointer transition-all"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.15)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            disabled={templatesLoading}
          >
            <option value="">
              {templatesLoading ? 'Loading templates...' : '-- Select a template --'}
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name} ({t.language})
              </option>
            ))}
          </select>
        </div>

        {/* Phone Numbers Textarea */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748b' }}>
            Phone Numbers <span style={{ color: '#ef4444' }}>*</span>
            <span className="text-[10px] ml-1 font-normal normal-case" style={{ color: '#94a3b8' }}>(one per line, max 50)</span>
          </label>
          <textarea
            value={phoneNumbers}
            onChange={(e) => setPhoneNumbers(e.target.value)}
            placeholder={"+971501234567\n+971509876543\n+919876543210"}
            className="w-full p-2.5 rounded-xl text-sm focus:outline-none h-32 resize-none font-mono transition-all"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.15)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs" style={{ color: isOverLimit ? '#ef4444' : '#94a3b8' }}>
              {phoneCount} / 50 numbers entered
            </span>
            {isOverLimit && (
              <span className="text-xs font-medium" style={{ color: '#ef4444' }}>
                Maximum 50 numbers per batch
              </span>
            )}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748b' }}>
            Language
          </label>
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full p-2.5 rounded-xl text-sm focus:outline-none transition-all"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.15)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            placeholder="en"
          />
        </div>

        {/* Header Image URL */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748b' }}>
            Header Image URL
            <span className="text-[10px] ml-1 font-normal normal-case" style={{ color: '#94a3b8' }}>(if template has media header)</span>
          </label>
          <input
            type="text"
            value={headerImageUrl}
            onChange={(e) => setHeaderImageUrl(e.target.value)}
            className="w-full p-2.5 rounded-xl text-sm focus:outline-none transition-all"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.15)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            placeholder="https://example.com/logo.png"
          />
        </div>

        {/* Parameters */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748b' }}>
            Parameters
            <span className="text-[10px] ml-1 font-normal normal-case" style={{ color: '#94a3b8' }}>(comma separated)</span>
          </label>
          <input
            type="text"
            value={parameters}
            onChange={(e) => setParameters(e.target.value)}
            className="w-full p-2.5 rounded-xl text-sm focus:outline-none transition-all"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.15)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            placeholder="John, Order123"
          />
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#94a3b8' }}>
            <span>ℹ️</span> These replace {'{{1}}'}, {'{{2}}'} in the template
          </p>
        </div>

        {/* Send Button */}
        <motion.button
          onClick={handleSend}
          disabled={loading || !selectedTemplateName || phoneCount === 0 || isOverLimit}
          className="w-full py-3 rounded-xl font-medium text-sm text-white flex items-center justify-center gap-2 transition-all"
          style={{
            background: loading || !selectedTemplateName || phoneCount === 0 || isOverLimit
              ? '#e2e8f0'
              : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            color: loading || !selectedTemplateName || phoneCount === 0 || isOverLimit
              ? '#94a3b8'
              : '#ffffff',
            boxShadow: loading || !selectedTemplateName || phoneCount === 0 || isOverLimit
              ? 'none'
              : '0 4px 14px rgba(124,58,237,0.25)',
            cursor: loading || !selectedTemplateName || phoneCount === 0 || isOverLimit
              ? 'not-allowed'
              : 'pointer',
          }}
          whileHover={!loading ? { scale: 1.02 } : {}}
          whileTap={!loading ? { scale: 0.98 } : {}}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Sending...
            </>
          ) : (
            <>
              <span>🚀</span> Send Bulk WhatsApp
            </>
          )}
        </motion.button>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        )}

        {/* Results */}
        {results && (
          <motion.div
            className="rounded-xl p-4 space-y-3"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-sm font-semibold" style={{ color: '#0f172a' }}>Results</h3>

            <div className="flex gap-4">
              <div className="flex items-center gap-1 text-sm">
                <span>✅</span>
                <span style={{ color: '#0f172a' }}>{results.success} sent successfully</span>
              </div>
              {results.failed > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <span>❌</span>
                  <span style={{ color: '#0f172a' }}>{results.failed} failed</span>
                </div>
              )}
            </div>

            {/* Show/Hide Failed */}
            {failedResults.length > 0 && (
              <div>
                <button
                  onClick={() => setShowFailed(!showFailed)}
                  className="text-xs flex items-center gap-1"
                  style={{ color: '#8b5cf6' }}
                >
                  <span className={`transform transition-transform ${showFailed ? 'rotate-90' : ''}`}>▶</span>
                  {showFailed ? 'Hide' : 'Show'} failed numbers
                </button>

                {showFailed && (
                  <div className="mt-2 space-y-1">
                    {failedResults.map((r, i) => (
                      <div key={i} className="text-xs flex items-center gap-2 pl-3" style={{ color: '#64748b' }}>
                        <span className="font-mono" style={{ color: '#ef4444' }}>{r.phone}</span>
                        <span style={{ color: '#cbd5e1' }}>—</span>
                        <span>{r.error || 'Unknown error'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default BulkSendPanel;
