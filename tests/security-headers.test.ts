import test from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../next.config';

test('HTTPS production responses include HSTS without affecting development', async () => {
  assert.ok(nextConfig.headers);
  const env = process.env as Record<string,string|undefined>;
  const previous = env.NODE_ENV;
  try {
    env.NODE_ENV = 'production';
    const production = await nextConfig.headers!();
    const productionHeaders = new Map(
      production.flatMap(item => item.headers).map(({key,value}) => [key,value])
    );
    assert.equal(productionHeaders.get('Strict-Transport-Security'),'max-age=31536000');
    assert.equal(productionHeaders.get('X-Frame-Options'),'DENY');
    assert.equal(productionHeaders.get('X-Content-Type-Options'),'nosniff');

    env.NODE_ENV = 'development';
    const development = await nextConfig.headers!();
    const developmentHeaders = new Map(
      development.flatMap(item => item.headers).map(({key,value}) => [key,value])
    );
    assert.equal(developmentHeaders.has('Strict-Transport-Security'),false);
  } finally {
    if (previous === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previous;
  }
});
