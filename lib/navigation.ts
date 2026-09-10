/** Lists own their document pages, but not independent sections nested under the same URL. */
export function isDocumentNavigationActive(pathname: string, listPath: string) {
  if (pathname === listPath || pathname === `${listPath}/`) return true;
  if (!pathname.startsWith(`${listPath}/`)) return false;
  const documentPath = pathname.slice(listPath.length + 1);
  return /^(?:new|\d+(?:\/edit)?)\/?$/.test(documentPath);
}
