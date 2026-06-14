/**
 * Catch-all route for Vue SPA
 * Returns index.html for all frontend routes
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // Skip API, file, and static asset routes
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/file/') ||
    url.pathname.startsWith('/share/') ||
    url.pathname.startsWith('/_nuxt/') ||
    url.pathname === '/admin.html' ||
    url.pathname === '/admin'
  ) {
    return new Response('Not Found', { status: 404 });
  }

  // Redirect admin routes to SPA
  if (url.pathname === '/admin/d1') {
    return Response.redirect(`${url.origin}/d1`, 302);
  }
  if (url.pathname === '/admin/mysql') {
    return Response.redirect(`${url.origin}/mysql`, 302);
  }

  // Serve index.html for Vue SPA routes
  try {
    const indexHtml = await context.env.ASSETS.fetch(new URL('/index.html', url.origin));
    return new Response(indexHtml.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return new Response('SPA not found', { status: 500 });
  }
}
