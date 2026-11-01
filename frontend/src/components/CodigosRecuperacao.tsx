export default function CodigosRecuperacao({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  function baixar() {
    const url = URL.createObjectURL(new Blob(['Locus — códigos de recuperação\nCada código funciona uma única vez.\n\n' + codes.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'locus-codigos-recuperacao.txt';
    link.click();
    URL.revokeObjectURL(url);
  }
  return <section aria-label="Códigos de recuperação">
    <h2>Guarde seus códigos de recuperação</h2>
    <p>Cada código funciona uma única vez. Guarde-os em um local seguro, separado da senha. Eles não serão exibidos novamente.</p>
    <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '0.85rem' }}>{codes.join('\n')}</pre>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" onClick={baixar}>Baixar códigos</button>
      <button type="button" onClick={onClose}>Guardei os códigos</button>
    </div>
  </section>;
}
