export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  jwt: { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
});
