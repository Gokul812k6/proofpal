interface Env { API: Fetcher }
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const response = await env.API.fetch(request);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
};
