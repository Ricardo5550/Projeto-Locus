export default function CodigosRecuperacao({
  codes,
  onClose,
}: {
  codes: string[];
  onClose: () => void;
}) {
  return (
    <section aria-label="Códigos de recuperação">
      <h2>Guarde seus códigos de recuperação</h2>

      <p>
        Cada código funciona uma única vez. Guarde-os em um local seguro,
        separado da senha. Eles não serão exibidos novamente.
      </p>

      <pre className="account-recovery-codes">{codes.join('\n')}</pre>

      <div className="account-actions">
        <button
          type="button"
          className="account-primary"
          onClick={onClose}
        >
          Guardei os códigos
        </button>
      </div>
    </section>
  );
}