/**
 * The dev proxy adds the server's token to every request it forwards, so it
 * must forward only requests from the dev page itself: any other site could
 * otherwise use it to reach the API.
 */
export function devOriginAllowed(origin: string | undefined, devOrigin: string): boolean {
  return origin === undefined || origin === devOrigin;
}
