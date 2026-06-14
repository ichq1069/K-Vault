/**
 * Redirect legacy /admin.html to Vue SPA /drive
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // /admin.html -> /drive
  if (url.pathname === '/admin.html' || url.pathname === '/admin') {
    return Response.redirect(`${url.origin}/drive`, 302);
  }
  
  // /admin/d1 -> /d1
  if (url.pathname === '/admin/d1') {
    return Response.redirect(`${url.origin}/d1`, 302);
  }
  
  // /admin/mysql -> /mysql
  if (url.pathname === '/admin/mysql') {
    return Response.redirect(`${url.origin}/mysql`, 302);
  }

  return new Response('Not Found', { status: 404 });
}
