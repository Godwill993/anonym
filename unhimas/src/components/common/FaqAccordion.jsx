import { useState } from 'react';
import { MdExpandMore } from 'react-icons/md';

export default function FaqAccordion({ items = [], title = 'Frequently Asked Questions' }) {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (idx) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="faq-container" style={{ margin: '1.5rem 0' }}>
      {title && (
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--color-primary)',
            marginBottom: '0.875rem',
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </h3>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {items.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface)',
                overflow: 'hidden',
                transition: 'border-color 0.15s ease',
              }}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                aria-expanded={isOpen}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: 'var(--color-text)',
                }}
              >
                <span>{item.question}</span>
                <MdExpandMore
                  style={{
                    fontSize: '1.25rem',
                    color: 'var(--color-text-muted)',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    flexShrink: 0,
                  }}
                />
              </button>
              {isOpen && (
                <div
                  style={{
                    padding: '0 1rem 0.875rem 1rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.6,
                    borderTop: '1px dashed var(--color-border)',
                    marginTop: '0.25rem',
                    paddingTop: '0.625rem',
                  }}
                >
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
