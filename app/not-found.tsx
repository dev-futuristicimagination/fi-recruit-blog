export default function NotFound() {
  return (
    <div style={{
      textAlign: 'center',
      padding: '120px 24px',
      background: '#ffffff',
      minHeight: '60vh',
    }}>
      <div style={{
        fontSize: '4rem',
        fontWeight: 900,
        color: '#5b4fcf',
        letterSpacing: '-0.03em',
        marginBottom: 12,
      }}>404</div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>
        ページが見つかりませんでした
      </h2>
      <p style={{ color: '#555570', marginBottom: 32 }}>
        お探しのページは移動または削除された可能性があります。
      </p>
      <a href="/" style={{
        background: '#5b4fcf', color: '#fff',
        padding: '12px 24px', borderRadius: 8,
        fontSize: '0.9rem', fontWeight: 600,
        textDecoration: 'none',
      }}>
        トップページへ戻る
      </a>
    </div>
  );
}
