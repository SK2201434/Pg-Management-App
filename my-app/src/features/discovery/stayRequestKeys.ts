// Query keys shared by the property page's request status and the tenant's live request list.
export const stayRequestKey = (uid: string | undefined, propertyId: string) => ['stayRequest', uid, propertyId] as const;
export const myStayRequestsLiveKey = (uid: string | undefined) => ['myStayRequests', 'live', uid] as const;
