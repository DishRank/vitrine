export default function M3Spinner({ size = 48, color = 'var(--primary)' }: { size?: number; color?: string }) {
  const s = size / 48;

  return (
    <div style={{ width: 64 * s, height: 56 * s, position: 'relative' }}>
      {/* Steam particles */}
      <span
        style={{
          position: 'absolute', top: 2 * s, left: 12 * s,
          width: 2 * s, height: 8 * s, borderRadius: 1,
          backgroundColor: color,
          animation: 'steam 1s infinite ease-in-out',
        }}
      />
      <span
        style={{
          position: 'absolute', top: 2 * s, left: 24 * s,
          width: 2 * s, height: 8 * s, borderRadius: 1,
          backgroundColor: color,
          animation: 'steam 1s 0.15s infinite ease-in-out',
        }}
      />
      <span
        style={{
          position: 'absolute', top: 2 * s, left: 34 * s,
          width: 2 * s, height: 8 * s, borderRadius: 1,
          backgroundColor: color,
          animation: 'steam 1s 0.3s infinite ease-in-out',
        }}
      />
      {/* Cup body */}
      <div
        style={{
          position: 'absolute',
          width: 42 * s,
          height: 34 * s,
          backgroundColor: color,
          borderRadius: `${4 * s}px ${4 * s}px ${12 * s}px ${12 * s}px`,
          top: 18 * s,
          left: 2 * s,
        }}
      />
      {/* Handle */}
      <div
        style={{
          position: 'absolute',
          width: 14 * s,
          height: 18 * s,
          borderTop: `${3.5 * s}px solid ${color}`,
          borderRight: `${3.5 * s}px solid ${color}`,
          borderBottom: `${3.5 * s}px solid ${color}`,
          borderLeft: 0,
          borderRadius: `0 ${4 * s}px ${4 * s}px 0`,
          top: 26 * s,
          left: 44 * s,
        }}
      />
    </div>
  );
}
