import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MdSearch,
  MdShield,
  MdVerified,
  MdPrint,
  MdArrowBack,
  MdHelpOutline,
} from 'react-icons/md';
import { lookupPublishedResults } from '../../services/results';
import { useTranslation } from '../../i18n';
import FaqAccordion from '../../components/common/FaqAccordion';
import logo from '../../assets/unhimas_logo.jpg';

export default function PublicResultsPage() {
  const { language, toggleLanguage } = useTranslation();
  const [matricule, setMatricule] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['public-result-lookup', matricule.trim().toUpperCase()],
    queryFn: async () => lookupPublishedResults(matricule.trim().toUpperCase()),
    enabled: submitted && Boolean(matricule.trim()),
    retry: false,
  });

  const onSubmit = (event) => {
    event.preventDefault();
    if (matricule.trim()) {
      setSubmitted(true);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Verification reference code
  const verificationRef = data?.length > 0
    ? `UNH-VER-${Math.abs(data[0].matricule.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)).toString(16).toUpperCase().padStart(8, '0')}`
    : null;

  const faqItems = [
    {
      question: language === 'fr' ? 'Qui publie ces résultats ?' : 'Who publishes these academic results?',
      answer: language === 'fr'
        ? 'Les résultats affichés ici sont officiellement approuvés par le conseil académique de l\'UNHIMAS. Seules les notes publiées sont consultables.'
        : 'The results displayed here are officially vetted and released by the UNHIMAS Academic Administration and Dean. Only final published marks are accessible through this portal.',
    },
    {
      question: language === 'fr' ? 'Que faire si mon relevé est incomplet ?' : 'What if a course grade is missing from my record?',
      answer: language === 'fr'
        ? 'Si un cours est manquant, il se peut que les notes soient encore au stade d\'évaluation ou de validation par le département.'
        : 'If an enrolled course does not appear, marks for that course may still be under lecturer review or administrative approval.',
    },
    {
      question: language === 'fr' ? 'Cette vérification est-elle valable pour les employeurs ?' : 'Is this verification valid for employers and sponsors?',
      answer: language === 'fr'
        ? 'Oui. La référence de vérification générée atteste de l\'authenticité des mentions enregistrées dans notre base de données sécurisée.'
        : 'Yes. The digital verification reference number and matricule validate the authenticity of the records against the university central database.',
    },
  ];

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: '3rem', paddingBottom: '3rem' }}>
      <div className="auth-card" style={{ maxWidth: '820px' }}>
        {/* Header */}
        <div className="auth-card-header" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button
              className="lang-btn"
              onClick={toggleLanguage}
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}
              title="Toggle Language"
            >
              {language === 'en' ? 'FR' : 'EN'}
            </button>
          </div>

          <img src={logo} alt="UNHIMAS logo" className="auth-logo" />
          <div className="auth-school-name">UNHIMAS</div>
          <div className="auth-school-subtitle">
            Universal Higher Institute of Management and Sciences
          </div>
          <div
            style={{
              marginTop: '0.35rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              background: 'rgba(255,255,255,0.12)',
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              color: '#fff',
            }}
          >
            <MdShield /> Official Public Result Verification Portal
          </div>
        </div>

        {/* Body */}
        <div className="auth-card-body" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h1 className="auth-title" style={{ textAlign: 'left', marginBottom: '0.25rem' }}>
                {language === 'fr' ? 'Vérification Officielle des Résultats' : 'Academic Result Verification'}
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                {language === 'fr'
                  ? 'Entrez le matricule de l\'étudiant pour consulter les résultats académiques publiés.'
                  : 'Enter student matricule to verify published grades and academic standing.'}
              </p>
            </div>
            <Link
              to="/login"
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <MdArrowBack /> {language === 'fr' ? 'Connexion' : 'Staff/Student Login'}
            </Link>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} style={{ marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="matricule">
                {language === 'fr' ? 'Matricule de l\'étudiant' : 'Student Matricule / Student ID'}
              </label>
              <div className="form-input-wrapper">
                <MdSearch
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)',
                    fontSize: '1.2rem',
                  }}
                />
                <input
                  id="matricule"
                  className="form-input"
                  style={{
                    paddingLeft: '2.5rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                  value={matricule}
                  onChange={(event) => {
                    setMatricule(event.target.value);
                    setSubmitted(false);
                  }}
                  placeholder="e.g. UNH/2026/SWE/001"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={isLoading || !matricule.trim()}
              style={{ fontSize: '0.95rem', padding: '0.75rem' }}
            >
              {isLoading ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  {language === 'fr' ? 'Vérification en cours…' : 'Verifying with Senate Records…'}
                </>
              ) : (
                language === 'fr' ? 'Vérifier le relevé' : 'Verify Official Result'
              )}
            </button>
          </form>

          {/* Error / Not found alerts */}
          {error && (
            <div className="auth-alert error" role="alert" style={{ marginBottom: '1.5rem' }}>
              {language === 'fr'
                ? 'Erreur lors de la vérification. Veuillez vérifier le matricule ou réessayer plus tard.'
                : 'Could not connect to the verification registry. Please check your matricule or retry shortly.'}
            </div>
          )}

          {submitted && !isLoading && !error && data?.length === 0 && (
            <div
              className="auth-alert"
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#92400e',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}
            >
              <MdHelpOutline style={{ fontSize: '1.4rem', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>
                  {language === 'fr' ? 'Aucun résultat publié trouvé' : 'No Published Results Found'}
                </strong>
                <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  {language === 'fr'
                    ? `Aucun résultat officiellement publié n'a été trouvé pour le matricule "${matricule.toUpperCase()}". Veuillez confirmer avec l'administration de l'UNHIMAS si les notes sont en cours de validation.`
                    : `No published marks were found for matricule "${matricule.toUpperCase()}". Results must be officially approved and published by the administration before appearing here.`}
                </p>
              </div>
            </div>
          )}

          {/* Verified Results Sheet */}
          {submitted && !isLoading && data?.length > 0 && (
            <div
              className="card"
              style={{
                marginBottom: '1.5rem',
                border: '2px solid rgba(17, 47, 66, 0.2)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(17, 47, 66, 0.08)',
              }}
            >
              {/* Official Seal Banner */}
              <div
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <MdVerified style={{ fontSize: '1.75rem', color: '#10b981' }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em' }}>
                      {data[0].student_name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)' }}>
                      Matricule: <strong>{data[0].matricule}</strong> • Batch: {data[0].batch_name}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    className="badge badge-green"
                    style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981' }}
                  >
                    ✓ OFFICIAL VERIFIED
                  </span>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="btn btn-sm"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}
                    title="Print Verification Slip"
                  >
                    <MdPrint /> Print Slip
                  </button>
                </div>
              </div>

              {/* Metadata Info Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '0.75rem',
                  padding: '0.875rem 1.25rem',
                  background: 'var(--color-bg)',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Academic Year:</span>{' '}
                  <strong>{data[0].academic_year}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Semester:</span>{' '}
                  <strong>{data[0].semester}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Verification Ref:</span>{' '}
                  <code style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{verificationRef}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Verified On:</span>{' '}
                  <strong>{new Date().toLocaleDateString()}</strong>
                </div>
              </div>

              {/* Courses Table */}
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Title</th>
                      <th style={{ textAlign: 'center' }}>Credits</th>
                      <th style={{ textAlign: 'center' }}>Total Score</th>
                      <th style={{ textAlign: 'center' }}>Letter Grade</th>
                      <th style={{ textAlign: 'center' }}>Grade Point</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx}>
                        <td>
                          <code style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                            {row.course_code}
                          </code>
                        </td>
                        <td>{row.course_name}</td>
                        <td style={{ textAlign: 'center' }}>{row.credit_units}</td>
                        <td style={{ textAlign: 'center' }}>
                          <strong>{row.total_score}</strong> / 100
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${row.grade === 'F' ? 'badge-red' : 'badge-green'}`}>
                            {row.grade}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>{row.grade_point}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Privacy Note */}
          <div
            className="form-hint"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.75rem',
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              marginTop: '1rem',
            }}
          >
            <MdShield style={{ color: 'var(--color-primary)', fontSize: '1rem', flexShrink: 0 }} />
            <span>
              {language === 'fr'
                ? 'Ce service de vérification applique une politique de sécurité stricte. Aucune information privée (contact, téléphone, mot de passe) n\'est exposée.'
                : 'Security Compliance Notice: This verification query uses a dedicated read-only RPC function adhering to strict privacy guidelines. Personal contact details and unapproved drafts are not exposed.'}
            </span>
          </div>

          {/* FAQ Accordion Component */}
          <FaqAccordion
            items={faqItems}
            title={language === 'fr' ? 'Questions Fréquentes' : 'Frequently Asked Questions'}
          />

          <div
            style={{
              textAlign: 'center',
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--color-border)',
              fontSize: '0.78rem',
              color: 'var(--color-text-muted)',
            }}
          >
            Universal Higher Institute of Management and Sciences • Bilingual Cameroonian Academic System
          </div>
        </div>
      </div>
    </div>
  );
}
