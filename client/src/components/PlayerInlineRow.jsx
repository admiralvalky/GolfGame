function scoreColor(val) {
  if (val === "E" || val === 0) return "text-pool-even";
  if (typeof val === "number") {
    if (val < 0) return "text-pool-under";
    if (val > 0) return "text-pool-over";
  }
  return "text-pool-faint";
}

export default function PlayerInlineRow({
  pos,
  name,
  thru,
  rounds = [null, null, null, null],
  countingRounds = [false, false, false, false],
  total,
  isCut = false,
}) {
  return (
    <div
      className={`bg-pool-elevated px-4 py-2 flex items-center gap-2${isCut ? " opacity-40" : ""}`}
    >
      {/* Position */}
      <span className="text-xs text-pool-muted w-8 flex-shrink-0">{pos}</span>

      {/* Player name */}
      <span
        className={`text-sm font-medium flex-1${
          isCut
            ? " line-through text-pool-muted"
            : " text-pool-primary"
        }`}
      >
        {name}
      </span>

      {/* Thru */}
      <span className="text-xs text-pool-muted w-8 text-center flex-shrink-0">
        {thru ?? "—"}
      </span>

      {/* Round score badges */}
      {rounds.map((score, i) => {
        if (score === null || score === undefined) {
          return (
            <span key={i} className="text-xs text-pool-faint w-8 text-center flex-shrink-0">
              —
            </span>
          );
        }
        const isCounting = countingRounds[i] === true;
        return (
          <span
            key={i}
            className={`text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0${
              isCounting
                ? " bg-pool-counting text-pool-counting-fg font-bold"
                : " bg-pool-surface text-pool-secondary"
            }`}
          >
            {score}
          </span>
        );
      })}

      {/* Total */}
      <span
        className={`font-mono font-bold text-sm flex-shrink-0 ml-1 ${scoreColor(total)}`}
      >
        {total ?? "—"}
      </span>
    </div>
  );
}
