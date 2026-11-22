export default function Chargement() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <div className="squelette" style={{ height: 44, width: "45%", marginBottom: 20 }} />
      <div className="grille-stats">
        <div className="squelette" style={{ height: 86 }} />
        <div className="squelette" style={{ height: 86 }} />
        <div className="squelette" style={{ height: 86 }} />
      </div>
      <div className="grille-2">
        <div className="squelette" style={{ height: 210 }} />
        <div className="squelette" style={{ height: 210 }} />
      </div>
    </div>
  );
}
