/**
 * Security Rules Specification & Verification Matrix for Nosso Roteiro.
 * Documents the 12 Dirty Dozen adversarial payloads verified against firestore.rules.
 */

export interface DirtyDozenCase {
  id: string;
  description: string;
  targetPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    description: 'Unverified email spoofing attempt',
    targetPath: 'itineraries/itin1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u1', email: 'm4rcelo69@gmail.com', email_verified: false },
    payload: { title: 'Natal', ownerUid: 'u1', ownerEmail: 'm4rcelo69@gmail.com' },
  },
  {
    id: 'DD-02',
    description: 'PII cross-user read on /users/{userId}',
    targetPath: 'users/u1',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u2', email: 'other@gmail.com', email_verified: true },
  },
  {
    id: 'DD-03',
    description: 'Shadow ghost field injection on itinerary create',
    targetPath: 'itineraries/itin1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u1', email: 'm4rcelo69@gmail.com', email_verified: true },
    payload: { title: 'Natal', isAdmin: true, ownerUid: 'u1' },
  },
  {
    id: 'DD-04',
    description: 'Owner UID spoofing on itinerary create',
    targetPath: 'itineraries/itin1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u1', email: 'm4rcelo69@gmail.com', email_verified: true },
    payload: { title: 'Natal', ownerUid: 'u2', ownerEmail: 'm4rcelo69@gmail.com' },
  },
  {
    id: 'DD-05',
    description: 'Client-forged createdAt timestamp instead of request.time',
    targetPath: 'itineraries/itin1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u1', email: 'm4rcelo69@gmail.com', email_verified: true },
    payload: { title: 'Natal', createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    id: 'DD-06',
    description: 'Blanket list scraping without linkedEmails filter',
    targetPath: 'itineraries',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u2', email: 'intruder@gmail.com', email_verified: true },
  },
  {
    id: 'DD-07',
    description: 'Collaborator removing ownerEmail from linkedEmails',
    targetPath: 'itineraries/itin1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u2', email: 'collab@gmail.com', email_verified: true },
    payload: { linkedEmails: ['collab@gmail.com'] },
  },
  {
    id: 'DD-08',
    description: 'Non-member creating an event inside shared itinerary',
    targetPath: 'itineraries/itin1/events/ev1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u3', email: 'outsider@gmail.com', email_verified: true },
    payload: { title: 'Invasao', date: '2026-12-13', time: '14:30' },
  },
  {
    id: 'DD-09',
    description: 'Malformed event date format or oversized notes field',
    targetPath: 'itineraries/itin1/events/ev1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u1', email: 'm4rcelo69@gmail.com', email_verified: true },
    payload: { title: 'Disney Celebra', date: '13/12/2026', time: '14:30' },
  },
  {
    id: 'DD-10',
    description: 'Path variable ID poisoning with invalid characters',
    targetPath: 'itineraries/bad$id*poison/events/ev1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u1', email: 'm4rcelo69@gmail.com', email_verified: true },
    payload: { title: 'Test' },
  },
  {
    id: 'DD-11',
    description: 'Immutable field mutation (createdByUid / createdAt)',
    targetPath: 'itineraries/itin1/events/ev1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u2', email: 'collab@gmail.com', email_verified: true },
    payload: { createdByUid: 'u2' },
  },
  {
    id: 'DD-12',
    description: 'Non-owner collaborator attempting to delete itinerary',
    targetPath: 'itineraries/itin1',
    operation: 'delete',
    expectedResult: 'PERMISSION_DENIED',
    auth: { uid: 'u2', email: 'collab@gmail.com', email_verified: true },
  },
];
