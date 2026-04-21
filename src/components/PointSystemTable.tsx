export default function PointSystemTable() {
  const placementPoints = [
    { placement: "Campeón", points: 30 },
    { placement: "Sub-Campeón", points: 25 },
    { placement: "Tercero", points: 21 },
    { placement: "4° de final", points: 17 },
    { placement: "8° de final", points: 13 },
    { placement: "16° de final", points: 10 },
    { placement: "32° de final", points: 8 },
    { placement: "64° de final", points: 6 },
    { placement: "128° de final", points: 4 },
    { placement: "Partido perdido en grupo", points: -2 },
  ];

  const ratingChanges = [
    { diff: "750 o más", higher: 1, lower: 28 },
    { diff: "500 a 749", higher: 2, lower: 26 },
    { diff: "400 a 499", higher: 3, lower: 24 },
    { diff: "300 a 399", higher: 4, lower: 22 },
    { diff: "200 a 299", higher: 5, lower: 20 },
    { diff: "150 a 199", higher: 6, lower: 18 },
    { diff: "100 a 149", higher: 7, lower: 16 },
    { diff: "50 a 99", higher: 8, lower: 14 },
    { diff: "25 a 49", higher: 9, lower: 12 },
    { diff: "0 a 24", higher: 10, lower: 10 },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card overflow-hidden">
        <div className="nav-dark px-5 py-2.5">
          <h3 className="text-foreground font-heading font-semibold text-sm">Puntos por Instancia Alcanzada</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-foreground uppercase tracking-wide">Instancia</th>
              <th className="text-center px-5 py-2.5 text-xs font-semibold text-foreground uppercase tracking-wide">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {placementPoints.map((row, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className="px-5 py-2 text-sm">{row.placement}</td>
                <td className={`px-5 py-2 text-sm text-center font-medium ${row.points < 0 ? "text-destructive" : "text-foreground"}`}>
                  {row.points > 0 ? `+${row.points}` : row.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="bg-muted px-5 py-2.5">
          <h3 className="text-foreground font-heading font-semibold text-sm">Puntos por Partido (Rating)</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30">
              <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wide">Diferencia</th>
              <th className="text-center px-5 py-2.5 text-xs font-semibold uppercase tracking-wide">Gana mayor</th>
              <th className="text-center px-5 py-2.5 text-xs font-semibold uppercase tracking-wide">Gana menor</th>
            </tr>
          </thead>
          <tbody>
            {ratingChanges.map((row, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className="px-5 py-2 text-sm">{row.diff}</td>
                <td className="px-5 py-2 text-sm text-center font-medium">±{row.higher}</td>
                <td className="px-5 py-2 text-sm text-center font-medium">±{row.lower}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
