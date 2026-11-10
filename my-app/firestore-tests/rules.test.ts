/**
 * @jest-environment node
 *
 * Firestore Security Rules tests. They run against the Firestore emulator:
 *   npm run test:rules        (needs Java 11+ for the emulator)
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import firebase from 'firebase/compat/app';

// The emulator test helpers return the compat Firestore API, so the tests use it too.
type Firestore = firebase.firestore.Firestore;
type DocRef = firebase.firestore.DocumentReference;
const Timestamp = firebase.firestore.Timestamp;
const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();
const doc = (db: Firestore, ...path: string[]): DocRef => db.doc(path.join('/'));
const setDoc = (ref: DocRef, data: Record<string, unknown>) => ref.set(data);
const getDoc = (ref: DocRef) => ref.get();
const updateDoc = (ref: DocRef, data: Record<string, unknown>) => ref.update(data);
const deleteDoc = (ref: DocRef) => ref.delete();
const writeBatch = (db: Firestore) => db.batch();

let env: RulesTestEnvironment;

const CODE = 'referralcode0123456789abcd';
const OTHER_CODE = 'otherreferral0123456789abc';

const ctx = (uid: string, verified = true) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: verified }).firestore();

const profile = (uid: string, role: 'owner' | 'tenant', extra: Record<string, unknown> = {}) => ({
  uid,
  role,
  accountType: role,
  status: 'active',
  displayName: uid,
  email: `${uid}@example.com`,
  phone: '9876543210',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

const inFuture = (ms: number) => Timestamp.fromMillis(Date.now() + ms);

/** Seeds documents bypassing rules. */
async function seed(fn: (db: Firestore) => Promise<void>) {
  await env.withSecurityRulesDisabled(async (context) => fn(context.firestore()));
}

async function seedOwnerWithProperty(owner = 'owner1', propertyId = 'p1') {
  await seed(async (db) => {
    await setDoc(doc(db, 'users', owner), {
      ...profile(owner, 'owner'),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'properties', propertyId), {
      ownerUid: owner,
      name: 'Sunrise PG',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
}

async function seedReferral(code = CODE, extra: Record<string, unknown> = {}) {
  await seed(async (db) => {
    await setDoc(doc(db, 'referrals', code), {
      type: 'property_join',
      createdBy: 'owner1',
      propertyId: 'p1',
      status: 'active',
      maxUses: 1,
      useCount: 0,
      expiresAt: inFuture(86_400_000),
      createdAt: Timestamp.now(),
      ...extra,
    });
  });
}

/** The three writes of a referral registration. */
function referralBatch(db: Firestore, uid: string, code = CODE, overrides: { profile?: Record<string, unknown>; member?: Record<string, unknown> } = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), profile(uid, 'tenant', { referralCode: code, ...overrides.profile }));
  batch.update(doc(db, 'referrals', code), {
    status: 'used',
    useCount: 1,
    usedBy: uid,
    usedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'properties', 'p1', 'members', uid), {
    tenantUid: uid,
    propertyId: 'p1',
    ownerUid: 'owner1',
    displayName: uid,
    referralCode: code,
    status: 'active',
    joinedAt: serverTimestamp(),
    ...overrides.member,
  });
  return batch;
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-hostell',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

describe('profile creation', () => {
  it('denies an unverified email', async () => {
    await assertFails(setDoc(doc(ctx('u1', false), 'users', 'u1'), profile('u1', 'tenant')));
    await assertFails(setDoc(doc(ctx('u1', false), 'users', 'u1'), profile('u1', 'owner')));
  });

  it('denies signed-out users', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, 'users', 'u1'), profile('u1', 'tenant')));
  });

  it('allows a verified user to self-register as tenant or owner', async () => {
    await assertSucceeds(setDoc(doc(ctx('t1'), 'users', 't1'), profile('t1', 'tenant')));
    await assertSucceeds(setDoc(doc(ctx('o1'), 'users', 'o1'), profile('o1', 'owner')));
  });

  it('requires a ten-digit phone number on a new profile', async () => {
    const db = ctx('u1');
    const { phone: _omit, ...withoutPhone } = profile('u1', 'tenant');
    await assertFails(setDoc(doc(db, 'users', 'u1'), withoutPhone));
    for (const bad of ['12345', '98765432101', '98765 43210', '+919876543210', 'abcdefghij']) {
      await assertFails(setDoc(doc(db, 'users', 'u1'), profile('u1', 'tenant', { phone: bad })));
    }
    await assertSucceeds(setDoc(doc(db, 'users', 'u1'), profile('u1', 'tenant', { phone: '9123456789' })));
  });

  it('never accepts a privileged or unknown role', async () => {
    for (const role of ['admin', 'superuser', '']) {
      await assertFails(setDoc(doc(ctx('u1'), 'users', 'u1'), profile('u1', role as 'owner', { accountType: role })));
    }
  });

  it('rejects a mismatched accountType, non-active status and extra fields', async () => {
    const db = ctx('u1');
    await assertFails(setDoc(doc(db, 'users', 'u1'), profile('u1', 'owner', { accountType: 'tenant' })));
    await assertFails(setDoc(doc(db, 'users', 'u1'), profile('u1', 'tenant', { status: 'disabled' })));
    await assertFails(setDoc(doc(db, 'users', 'u1'), profile('u1', 'tenant', { isAdmin: true })));
  });

  it("rejects writing another user's profile or a foreign email", async () => {
    await assertFails(setDoc(doc(ctx('u1'), 'users', 'u2'), profile('u2', 'tenant')));
    await assertFails(setDoc(doc(ctx('u1'), 'users', 'u1'), profile('u1', 'tenant', { email: 'x@evil.com' })));
  });

  it('does not allow re-creating an existing (e.g. disabled) profile', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', 'u1'), { ...profile('u1', 'tenant'), status: 'disabled', createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
    await assertFails(setDoc(doc(ctx('u1'), 'users', 'u1'), profile('u1', 'owner')));
  });
});

describe('own-profile reads (no circular dependency on an existing profile)', () => {
  it('lets a signed-in user read their own profile when it does not exist yet', async () => {
    // A missing document must come back as "does not exist", not permission-denied.
    for (const verified of [true, false]) {
      const snap = await assertSucceeds(getDoc(doc(ctx('new1', verified), 'users', 'new1')));
      expect(snap.exists).toBe(false);
    }
  });

  it('lets a user read their own existing profile', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', 't1'), { ...profile('t1', 'tenant'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
    const snap = await assertSucceeds(getDoc(doc(ctx('t1'), 'users', 't1')));
    expect(snap.exists).toBe(true);
  });

  it("denies reading another user's profile, existing or not, and signed-out reads", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', 't2'), { ...profile('t2', 'tenant'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
    await assertFails(getDoc(doc(ctx('t1'), 'users', 't2')));
    await assertFails(getDoc(doc(ctx('t1'), 'users', 'nobody')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users', 't2')));
  });

  it('provisions after verification: denied while unverified, allowed once the token claim is verified', async () => {
    await assertFails(setDoc(doc(ctx('u1', false), 'users', 'u1'), profile('u1', 'owner')));
    await assertSucceeds(setDoc(doc(ctx('u1', true), 'users', 'u1'), profile('u1', 'owner')));
    const snap = await assertSucceeds(getDoc(doc(ctx('u1'), 'users', 'u1')));
    expect(snap.exists).toBe(true);
  });

  it('keeps protected data closed to an unverified user', async () => {
    await seedOwnerWithProperty('owner1', 'p1');
    await assertFails(getDoc(doc(ctx('owner1', false), 'properties', 'p1')));
    await assertSucceeds(getDoc(doc(ctx('owner1', true), 'properties', 'p1')));
  });
});

describe('immutable role and status', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', 't1'), { ...profile('t1', 'tenant'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'users', 't2'), { ...profile('t2', 'tenant'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
  });

  it('lets a user read only their own profile', async () => {
    await assertSucceeds(getDoc(doc(ctx('t1'), 'users', 't1')));
    await assertFails(getDoc(doc(ctx('t1'), 'users', 't2')));
  });

  it('lets a user change displayName/phone only', async () => {
    const ref = doc(ctx('t1'), 'users', 't1');
    await assertSucceeds(updateDoc(ref, { displayName: 'New Name', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { role: 'owner', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { accountType: 'owner', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { status: 'disabled', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { email: 'other@example.com', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { referralCode: CODE, updatedAt: serverTimestamp() }));
  });

  it('keeps the phone number required and ten digits when a profile is edited', async () => {
    const ref = doc(ctx('t1'), 'users', 't1');
    await assertSucceeds(updateDoc(ref, { phone: '9000000001', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { phone: '123', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { phone: firebase.firestore.FieldValue.delete(), updatedAt: serverTimestamp() }));
  });

  it("denies editing someone else's profile and deleting any profile", async () => {
    await assertFails(updateDoc(doc(ctx('t1'), 'users', 't2'), { displayName: 'x', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(ctx('t1'), 'users', 't1')));
  });
});

describe('referrals', () => {
  beforeEach(async () => {
    await seedOwnerWithProperty('owner1', 'p1');
  });

  const newReferral = (extra: Record<string, unknown> = {}) => ({
    type: 'property_join',
    createdBy: 'owner1',
    propertyId: 'p1',
    status: 'active',
    maxUses: 1,
    useCount: 0,
    expiresAt: inFuture(86_400_000),
    createdAt: serverTimestamp(),
    ...extra,
  });

  it('lets only the property owner create a single-use referral', async () => {
    await assertSucceeds(setDoc(doc(ctx('owner1'), 'referrals', CODE), newReferral()));
  });

  it('rejects referrals from non-owners, other owners, unverified owners and bad shapes', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', 't1'), { ...profile('t1', 'tenant'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'users', 'owner2'), { ...profile('owner2', 'owner'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
    await assertFails(setDoc(doc(ctx('t1'), 'referrals', CODE), newReferral({ createdBy: 't1' })));
    await assertFails(setDoc(doc(ctx('owner2'), 'referrals', CODE), newReferral({ createdBy: 'owner2' })));
    await assertFails(setDoc(doc(ctx('owner1', false), 'referrals', CODE), newReferral()));
    await assertFails(setDoc(doc(ctx('owner1'), 'referrals', 'short'), newReferral()));
    await assertFails(setDoc(doc(ctx('owner1'), 'referrals', CODE), newReferral({ maxUses: 5 })));
    await assertFails(setDoc(doc(ctx('owner1'), 'referrals', CODE), newReferral({ useCount: 1 })));
    await assertFails(setDoc(doc(ctx('owner1'), 'referrals', CODE), newReferral({ expiresAt: inFuture(90 * 86_400_000) })));
    await assertFails(setDoc(doc(ctx('owner1'), 'referrals', CODE), newReferral({ type: 'owner_referral' })));
  });

  it('is readable by exact code only, and listable only by its creator', async () => {
    await seedReferral();
    await seed(async (db) => {
      await setDoc(doc(db, 'users', 't1'), { ...profile('t1', 'tenant'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
    await assertSucceeds(getDoc(doc(ctx('t1'), 'referrals', CODE)));
    await assertFails(getDoc(doc(ctx('t1', false), 'referrals', CODE)));
  });

  it('lets the owner revoke an active referral but not edit anything else', async () => {
    await seedReferral();
    const ref = doc(ctx('owner1'), 'referrals', CODE);
    await assertFails(updateDoc(ref, { maxUses: 100 }));
    await assertSucceeds(updateDoc(ref, { status: 'revoked' }));
  });
});

describe('referral consumption (atomic batch)', () => {
  beforeEach(async () => {
    await seedOwnerWithProperty('owner1', 'p1');
    await seedReferral();
  });

  it('creates profile, membership and consumes the referral together', async () => {
    await assertSucceeds(referralBatch(ctx('t1'), 't1').commit());
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      expect((await getDoc(doc(db, 'referrals', CODE))).data()).toMatchObject({ status: 'used', usedBy: 't1' });
      expect((await getDoc(doc(db, 'users', 't1'))).data()).toMatchObject({ role: 'tenant' });
      expect((await getDoc(doc(db, 'properties', 'p1', 'members', 't1'))).exists).toBe(true);
    });
  });

  it('cannot be reused after it has been consumed', async () => {
    await assertSucceeds(referralBatch(ctx('t1'), 't1').commit());
    await assertFails(referralBatch(ctx('t2'), 't2').commit());
  });

  it('lets only one of two concurrent claims win', async () => {
    const results = await Promise.allSettled([
      referralBatch(ctx('t1'), 't1').commit(),
      referralBatch(ctx('t2'), 't2').commit(),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('is denied for an unverified email', async () => {
    await assertFails(referralBatch(ctx('t1', false), 't1').commit());
  });

  it('is denied when expired, revoked or missing', async () => {
    await seedReferral(OTHER_CODE, { expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    await assertFails(referralBatch(ctx('t1'), 't1', OTHER_CODE).commit());
    await seed(async (db) => updateDoc(doc(db, 'referrals', CODE), { status: 'revoked' }));
    await assertFails(referralBatch(ctx('t2'), 't2').commit());
    await assertFails(referralBatch(ctx('t3'), 't3', 'doesnotexist0123456789ab').commit());
  });

  it('cannot grant the owner role (or ownership of the property)', async () => {
    await assertFails(referralBatch(ctx('t1'), 't1', CODE, { profile: { role: 'owner', accountType: 'owner' } }).commit());
    await assertFails(
      setDoc(doc(ctx('t1'), 'properties', 'p1'), { ownerUid: 't1', name: 'Mine', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(referralBatch(ctx('t2'), 't2').commit());
    await assertFails(updateDoc(doc(ctx('t2'), 'properties', 'p1'), { name: 'Hijacked', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(ctx('t2'), 'properties', 'p1'), { ownerUid: 't2', name: 'Hijacked', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });

  it('fails as a whole when one write is invalid (no partial state)', async () => {
    // Membership for a different property than the referral's.
    const batch = referralBatch(ctx('t1'), 't1', CODE, { member: { propertyId: 'p2' } });
    await assertFails(batch.commit());
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      expect((await getDoc(doc(db, 'users', 't1'))).exists).toBe(false);
      expect((await getDoc(doc(db, 'referrals', CODE))).data()?.status).toBe('active');
    });
  });

  it('rejects a profile that claims a referral without consuming it', async () => {
    await assertFails(setDoc(doc(ctx('t1'), 'users', 't1'), profile('t1', 'tenant', { referralCode: CODE })));
  });

  it('rejects burning a referral without a profile and membership', async () => {
    await assertFails(
      updateDoc(doc(ctx('t1'), 'referrals', CODE), { status: 'used', useCount: 1, usedBy: 't1', usedAt: serverTimestamp() }),
    );
  });

  it('rejects an existing user burning a referral', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', 't1'), { ...profile('t1', 'tenant'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
    await assertFails(referralBatch(ctx('t1'), 't1').commit());
  });
});

describe('referral credits', () => {
  const increment = (n: number) => firebase.firestore.FieldValue.increment(n);
  const complete = (db: Firestore, referred: string, credits = 100, referrer = 'owner1', propertyId = 'pr3') => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'inviteReferrals', referred), { status: 'completed', completedAt: serverTimestamp(), propertyId });
    batch.update(doc(db, 'users', referrer), { credits: increment(credits) });
    return batch;
  };

  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', 'owner1'), { ...profile('owner1', 'owner'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'users', 'owner2'), { ...profile('owner2', 'owner'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'users', 'o3'), { ...profile('o3', 'owner'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'properties', 'pr3'), { ownerUid: 'o3', name: 'P', setupStatus: 'ready', createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'properties', 'pr3draft'), { ownerUid: 'o3', name: 'P', setupStatus: 'draft', createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'properties', 'pr2'), { ownerUid: 'owner2', name: 'P', setupStatus: 'ready', createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'inviteReferrals', 'o3'), {
        referrerUid: 'owner1', referredUid: 'o3', code: 'ABCDEFGHJK', status: 'registered', registeredAt: Timestamp.now(),
      });
    });
  });

  it('credits 100 to the referrer when the referred owner registers a property, once', async () => {
    await assertSucceeds(complete(ctx('o3'), 'o3').commit());
    await seed(async (db) => {
      expect((await getDoc(doc(db, 'users', 'owner1'))).data()?.credits).toBe(100);
    });
    await assertFails(complete(ctx('o3'), 'o3').commit());
  });

  it('rejects completing without the credit, with the wrong amount, or crediting someone else', async () => {
    await assertFails(updateDoc(doc(ctx('o3'), 'inviteReferrals', 'o3'), { status: 'completed', completedAt: serverTimestamp(), propertyId: 'pr3' }));
    await assertFails(complete(ctx('o3'), 'o3', 500).commit());
    await assertFails(complete(ctx('o3'), 'o3', 10).commit());
    await assertFails(complete(ctx('o3'), 'o3', 100, 'owner2').commit());
  });

  it('rejects completion with no property, a draft property, or a property owned by someone else', async () => {
    await assertFails(complete(ctx('o3'), 'o3', 100, 'owner1', 'missing').commit());
    await assertFails(complete(ctx('o3'), 'o3', 100, 'owner1', 'pr3draft').commit());
    await assertFails(complete(ctx('o3'), 'o3', 100, 'owner1', 'pr2').commit());
  });

  it('rejects a credit with no completing referral, and any direct edit of credits', async () => {
    await assertFails(updateDoc(doc(ctx('owner2'), 'users', 'owner1'), { credits: 10 }));
    await assertFails(updateDoc(doc(ctx('owner1'), 'users', 'owner1'), { credits: 999, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx('o3'), 'users', 'owner1'), { credits: increment(100) }));
  });
});

describe('property location field', () => {
  const base = () => ({ ownerUid: 'owner1', name: 'Sunrise PG', city: 'Visakhapatnam', state: 'Andhra Pradesh', postalCode: '530041', contactName: 'Ravi', contactPhone: '9876543210', setupStatus: 'ready', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', 'owner1'), { ...profile('owner1', 'owner'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
  });

  it('lets an active owner create a property with an optional short location', async () => {
    await assertSucceeds(setDoc(doc(ctx('owner1'), 'properties', 'a'), base()));
    await assertSucceeds(setDoc(doc(ctx('owner1'), 'properties', 'b'), { ...base(), location: 'MVP Colony, Visakhapatnam' }));
  });

  it('requires location, city, postal code and contact details on create', async () => {
    const db = ctx('owner1');
    for (const key of ['location', 'city', 'state', 'postalCode', 'contactName', 'contactPhone']) {
      const { [key]: _omitted, ...rest } = { ...base(), location: 'x' } as Record<string, unknown>;
      await assertFails(setDoc(doc(db, 'properties', 'req'), rest));
    }
  });

  it('rejects an empty/oversized location, unknown fields and a foreign ownerUid', async () => {
    const db = ctx('owner1');
    await assertFails(setDoc(doc(db, 'properties', 'c'), { ...base(), location: '' }));
    await assertFails(setDoc(doc(db, 'properties', 'c'), { ...base(), location: 'x'.repeat(201) }));
    await assertFails(setDoc(doc(db, 'properties', 'c'), { ...base(), status: 'active' }));
    await assertFails(setDoc(doc(db, 'properties', 'c'), { ...base(), ownerUid: 'owner2' }));
  });

  it('lets only the owner edit the location', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'properties', 'p1'), { ownerUid: 'owner1', name: 'N', createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
    await assertSucceeds(updateDoc(doc(ctx('owner1'), 'properties', 'p1'), { location: 'Somewhere', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx('owner1'), 'properties', 'p1'), { ownerUid: 'owner2', updatedAt: serverTimestamp() }));
  });
});

describe('property setup: draft, rooms and beds', () => {
  const property = (extra: Record<string, unknown> = {}) => ({
    ownerUid: 'owner1',
    name: 'Sunrise PG',
    location: 'MVP Colony',
    city: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    postalCode: '530041',
    contactName: 'Ravi',
    contactPhone: '9876543210',
    setupStatus: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  });
  const room = (extra: Record<string, unknown> = {}) => ({
    ownerUid: 'owner1',
    propertyId: 'p1',
    roomNumber: '101',
    floor: 1,
    sharing: 2,
    ac: false,
    rentPerBedInr: 8500,
    updatedAt: serverTimestamp(),
    ...extra,
  });
  const bed = (extra: Record<string, unknown> = {}) => ({
    ownerUid: 'owner1',
    propertyId: 'p1',
    roomId: 'r1',
    label: 'Bed 1',
    status: 'available',
    updatedAt: serverTimestamp(),
    ...extra,
  });

  beforeEach(async () => {
    await seed(async (db) => {
      for (const [uid, role] of [['owner1', 'owner'], ['owner2', 'owner'], ['t1', 'tenant']] as const) {
        await setDoc(doc(db, 'users', uid), { ...profile(uid, role), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      }
    });
  });

  it('creates a draft property, then rooms and beds in one batch, then finalizes', async () => {
    const db = ctx('owner1');
    await assertSucceeds(setDoc(doc(db, 'properties', 'p1'), property()));
    const batch = writeBatch(db);
    batch.set(doc(db, 'properties', 'p1', 'rooms', 'r1'), room());
    batch.set(doc(db, 'properties', 'p1', 'rooms', 'r1', 'beds', 'r1_b1'), bed());
    batch.set(doc(db, 'properties', 'p1', 'rooms', 'r1', 'beds', 'r1_b2'), bed({ label: 'Bed 2' }));
    await assertSucceeds(batch.commit());
    await assertSucceeds(
      updateDoc(doc(db, 'properties', 'p1'), { photos: [{ path: 'a', url: 'b' }], setupStatus: 'ready', updatedAt: serverTimestamp() }),
    );
  });

  it('is idempotent: re-writing the same room and bed succeeds', async () => {
    const db = ctx('owner1');
    await setDoc(doc(db, 'properties', 'p1'), property());
    await assertSucceeds(setDoc(doc(db, 'properties', 'p1', 'rooms', 'r1'), room()));
    await assertSucceeds(setDoc(doc(db, 'properties', 'p1', 'rooms', 'r1'), room()));
    await assertSucceeds(setDoc(doc(db, 'properties', 'p1', 'rooms', 'r1', 'beds', 'b'), bed()));
    await assertSucceeds(setDoc(doc(db, 'properties', 'p1', 'rooms', 'r1', 'beds', 'b'), bed()));
  });

  it('only allows draft -> ready, never back, and never ownership changes', async () => {
    const db = ctx('owner1');
    await setDoc(doc(db, 'properties', 'p1'), property({ setupStatus: 'ready' }));
    await assertFails(updateDoc(doc(db, 'properties', 'p1'), { setupStatus: 'draft', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'properties', 'p1'), { ownerUid: 'owner2', updatedAt: serverTimestamp() }));
  });

  it('rejects invalid rooms and beds', async () => {
    const db = ctx('owner1');
    await setDoc(doc(db, 'properties', 'p1'), property());
    const r = (extra: Record<string, unknown>) => setDoc(doc(db, 'properties', 'p1', 'rooms', 'a'), room(extra));
    await assertFails(r({ sharing: 0 }));
    await assertFails(r({ sharing: 13 }));
    await assertFails(r({ rentPerBedInr: -5 }));
    await assertFails(r({ rentPerBedInr: 85.5 }));
    await assertFails(r({ occupied: 2 }));
    await assertFails(r({ propertyId: 'other' }));
    await assertFails(r({ ownerUid: 'owner2' }));
    const b = (extra: Record<string, unknown>) => setDoc(doc(db, 'properties', 'p1', 'rooms', 'r1', 'beds', 'b1'), bed(extra));
    await assertFails(b({ status: 'occupied' }));
    await assertFails(b({ roomId: 'other' }));
    await assertFails(b({ tenantUid: 't1' }));
  });

  it('allows up to 4 property photos and 4 room photos, and rejects more', async () => {
    const db = ctx('owner1');
    await setDoc(doc(db, 'properties', 'p1'), property());
    const shot = { path: 'p', url: 'u' };
    const list = (n: number) => Array.from({ length: n }, () => shot);
    const upd = (extra: Record<string, unknown>) => updateDoc(doc(db, 'properties', 'p1'), { ...extra, updatedAt: serverTimestamp() });
    await assertSucceeds(upd({ photos: list(4), roomPhotos: list(4) }));
    await assertFails(upd({ photos: list(5) }));
    await assertFails(upd({ roomPhotos: list(5) }));
  });

  it('accepts a room without floor or rent (not configured)', async () => {
    const db = ctx('owner1');
    await setDoc(doc(db, 'properties', 'p1'), property());
    const bare = { ownerUid: 'owner1', propertyId: 'p1', roomNumber: '1', sharing: 1, ac: true, updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db, 'properties', 'p1', 'rooms', 'r9'), bare));
  });

  it("keeps another owner's, a tenant's and an unverified user's hands off", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'properties', 'p1'), { ownerUid: 'owner1', name: 'N', setupStatus: 'ready', createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
    const path = (db: Firestore) => doc(db, 'properties', 'p1', 'rooms', 'rx');
    await assertFails(setDoc(path(ctx('owner2')), room({ ownerUid: 'owner2' })));
    await assertFails(setDoc(path(ctx('owner2')), room()));
    await assertFails(setDoc(path(ctx('t1')), room({ ownerUid: 't1' })));
    await assertFails(setDoc(path(ctx('owner1', false)), room()));
    await assertSucceeds(setDoc(path(ctx('owner1')), room()));
    await assertFails(getDoc(path(ctx('owner2'))));
    await assertFails(getDoc(path(ctx('t1'))));
    await assertSucceeds(getDoc(path(ctx('owner1'))));
  });
});

describe('property geo coordinates', () => {
  const GeoPoint = firebase.firestore.GeoPoint;
  const draft = () => ({
    ownerUid: 'owner1',
    name: 'Sunrise PG',
    location: 'MVP Colony',
    city: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    postalCode: '530041',
    contactName: 'Ravi',
    contactPhone: '9876543210',
    setupStatus: 'ready',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', 'owner1'), { ...profile('owner1', 'owner'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'users', 'owner2'), { ...profile('owner2', 'owner'), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
  });

  it('accepts a GeoPoint on create and rejects any other shape', async () => {
    const db = ctx('owner1');
    await assertSucceeds(setDoc(doc(db, 'properties', 'g1'), { ...draft(), geo: new GeoPoint(17.78, 83.37) }));
    await assertFails(setDoc(doc(db, 'properties', 'g2'), { ...draft(), geo: { latitude: 17.78, longitude: 83.37 } }));
    await assertFails(setDoc(doc(db, 'properties', 'g3'), { ...draft(), geo: '17.78,83.37' }));
  });

  it('lets only the owner add coordinates to an existing property later', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'properties', 'p1'), { ...draft(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
    const geo = new GeoPoint(17.78, 83.37);
    await assertFails(updateDoc(doc(ctx('owner2'), 'properties', 'p1'), { geo, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx('owner1', false), 'properties', 'p1'), { geo, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx('owner1'), 'properties', 'p1'), { geo: 'nope', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(ctx('owner1'), 'properties', 'p1'), { geo, updatedAt: serverTimestamp() }));
  });
});

describe('cross-owner access and tenant privacy', () => {
  beforeEach(async () => {
    await seedOwnerWithProperty('owner1', 'p1');
    await seedOwnerWithProperty('owner2', 'p2');
    await seed(async (db) => {
      const now = Timestamp.now();
      await setDoc(doc(db, 'users', 't1'), { ...profile('t1', 'tenant'), createdAt: now, updatedAt: now });
      await setDoc(doc(db, 'users', 't2'), { ...profile('t2', 'tenant'), createdAt: now, updatedAt: now });
      for (const [tenant, property, owner] of [['t1', 'p1', 'owner1'], ['t2', 'p2', 'owner2']]) {
        await setDoc(doc(db, 'properties', property, 'members', tenant), {
          tenantUid: tenant, propertyId: property, ownerUid: owner, displayName: tenant,
          referralCode: CODE, status: 'active', joinedAt: now,
        });
        await setDoc(doc(db, 'stays', `stay-${tenant}`), {
          ownerUid: owner, tenantUid: tenant, propertyId: property, status: 'active', updatedAt: now,
        });
      }
    });
  });

  it('keeps property writes and private data scoped to the owner, while browsable properties are readable', async () => {
    await assertSucceeds(getDoc(doc(ctx('owner1'), 'properties', 'p1')));
    await assertSucceeds(getDoc(doc(ctx('owner1'), 'properties', 'p2'))); // browsable (no setupStatus counts as ready)
    await assertSucceeds(getDoc(doc(ctx('t1'), 'properties', 'p1')));
    await assertFails(getDoc(doc(ctx('t1'), 'properties', 'p2', 'members', 't2'))); // another property's tenants stay private
    await assertFails(getDoc(doc(ctx('owner1'), 'properties', 'p2', 'members', 't2')));
    await assertFails(updateDoc(doc(ctx('owner1'), 'properties', 'p2'), { name: 'x', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(ctx('owner1'), 'properties', 'p2')));
  });

  it('only lets an owner create properties for themselves', async () => {
    const data = (ownerUid: string) => ({ ownerUid, name: 'New', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await assertSucceeds(setDoc(doc(ctx('owner1'), 'properties', 'p3'), data('owner1')));
    await assertFails(setDoc(doc(ctx('owner1'), 'properties', 'p4'), data('owner2')));
    await assertFails(setDoc(doc(ctx('t1'), 'properties', 'p5'), data('t1')));
    await assertFails(setDoc(doc(ctx('owner1', false), 'properties', 'p6'), data('owner1')));
  });

  it('hides a tenant stay from other tenants and other owners', async () => {
    await assertSucceeds(getDoc(doc(ctx('t1'), 'stays', 'stay-t1')));
    await assertSucceeds(getDoc(doc(ctx('owner1'), 'stays', 'stay-t1')));
    await assertFails(getDoc(doc(ctx('t2'), 'stays', 'stay-t1')));
    await assertFails(getDoc(doc(ctx('owner2'), 'stays', 'stay-t1')));
  });

  it('does not let a tenant write stays or read other tenants’ memberships', async () => {
    await assertFails(updateDoc(doc(ctx('t1'), 'stays', 'stay-t1'), { status: 'ended', updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(ctx('t1'), 'properties', 'p1', 'members', 't2')));
    await assertFails(getDoc(doc(ctx('t2'), 'properties', 'p1', 'members', 't1')));
    await assertSucceeds(getDoc(doc(ctx('owner1'), 'properties', 'p1', 'members', 't1')));
    await assertFails(getDoc(doc(ctx('owner2'), 'properties', 'p1', 'members', 't1')));
  });

  it('only lets an owner create stays for their own property and its members', async () => {
    const stay = (property: string, tenant: string, owner = 'owner1') => ({
      ownerUid: owner, tenantUid: tenant, propertyId: property, status: 'active', updatedAt: serverTimestamp(),
    });
    await assertSucceeds(setDoc(doc(ctx('owner1'), 'stays', 'new1'), stay('p1', 't1')));
    await assertFails(setDoc(doc(ctx('owner1'), 'stays', 'new2'), stay('p2', 't2'))); // not their property
    await assertFails(setDoc(doc(ctx('owner1'), 'stays', 'new3'), stay('p1', 't2'))); // not a member
  });

  it('lets a tenant read property updates only during their stay', async () => {
    const day = 24 * 60 * 60 * 1000;
    const update = { ownerUid: 'owner1', propertyId: 'p1', title: 'T', message: 'M', category: 'notice', createdAt: Timestamp.now() };
    await seed(async (db) => setDoc(doc(db, 'properties', 'p1', 'updates', 'u1'), update));
    const member = (tenant: string) => doc(ctx('owner1'), 'properties', 'p1', 'members', tenant);
    const read = (uid: string) => getDoc(doc(ctx(uid), 'properties', 'p1', 'updates', 'u1'));

    // No check-in date recorded: nothing readable.
    await assertFails(read('t1'));
    // Before check-in.
    await assertSucceeds(updateDoc(member('t1'), { checkInAt: inFuture(day) }));
    await assertFails(read('t1'));
    // During the stay (open-ended, then with a future check-out).
    await assertSucceeds(updateDoc(member('t1'), { checkInAt: inFuture(-day) }));
    await assertSucceeds(read('t1'));
    await assertSucceeds(updateDoc(member('t1'), { checkOutAt: inFuture(day) }));
    await assertSucceeds(read('t1'));
    // After check-out.
    await assertSucceeds(updateDoc(member('t1'), { checkOutAt: inFuture(-day / 2) }));
    await assertFails(read('t1'));
    // Another property's tenant, and the owner.
    await assertFails(read('t2'));
    await assertSucceeds(read('owner1'));
  });

  it('only lets the owner set a valid stay window and publish updates', async () => {
    const day = 24 * 60 * 60 * 1000;
    const member = (uid: string) => doc(ctx(uid), 'properties', 'p1', 'members', 't1');
    await assertFails(updateDoc(member('t1'), { checkInAt: inFuture(-day) }));
    await assertFails(updateDoc(doc(ctx('owner2'), 'properties', 'p1', 'members', 't1'), { checkInAt: inFuture(-day) }));
    await assertFails(updateDoc(member('owner1'), { status: 'inactive' }));
    await assertFails(updateDoc(member('owner1'), { checkOutAt: inFuture(day) })); // no check-in
    await assertSucceeds(updateDoc(member('owner1'), { checkInAt: inFuture(-day), checkOutAt: inFuture(day) }));
    await assertFails(updateDoc(member('owner1'), { checkOutAt: inFuture(-2 * day) })); // before check-in

    const update = { ownerUid: 'owner1', propertyId: 'p1', title: 'T', message: 'M', category: 'notice', createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(ctx('owner1'), 'properties', 'p1', 'updates', 'n1'), { ...update, createdAt: Timestamp.now() }));
    await assertFails(setDoc(doc(ctx('t1'), 'properties', 'p1', 'updates', 'n2'), { ...update, ownerUid: 't1', createdAt: Timestamp.now() }));
    await assertFails(setDoc(doc(ctx('owner2'), 'properties', 'p1', 'updates', 'n3'), { ...update, ownerUid: 'owner2', createdAt: Timestamp.now() }));
    await assertFails(setDoc(doc(ctx('owner1'), 'properties', 'p1', 'updates', 'n4'), { ...update, category: 'other', createdAt: Timestamp.now() }));
  });

  it('lets a tenant raise requests only for their own active membership', async () => {
    const day = 24 * 60 * 60 * 1000;
    const req = (tenant: string, extra: Record<string, unknown> = {}) => ({
      tenantUid: tenant, ownerUid: 'owner1', propertyId: 'p1', category: 'wifi', title: 'Wi-Fi drops',
      description: 'Drops every evening.', status: 'open', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
    });
    const col = (uid: string, property = 'p1') => ctx(uid).collection(`properties/${property}/requests`);

    await assertSucceeds(col('t1').doc('r1').set(req('t1')));
    await assertFails(col('t1').doc('r2').set(req('t2'))); // on behalf of another tenant
    await assertFails(col('t1').doc('r3').set(req('t1', { status: 'resolved' }))); // owner-controlled status
    await assertFails(col('t1').doc('r4').set(req('t1', { ownerUid: 'owner2' }))); // wrong owner
    await assertFails(col('t1').doc('r5').set(req('t1', { category: 'bogus' })));
    await assertFails(col('t1').doc('r6').set(req('t1', { title: '' })));
    await assertFails(col('t1', 'p2').doc('r7').set(req('t1', { propertyId: 'p2', ownerUid: 'owner2' }))); // not their property
    await assertFails(col('owner1').doc('r8').set(req('owner1'))); // owners do not raise tenant requests

    // Reading: only the tenant's own requests and the owner's; no edits by the tenant.
    await assertSucceeds(getDoc(doc(ctx('t1'), 'properties', 'p1', 'requests', 'r1')));
    await assertSucceeds(getDoc(doc(ctx('owner1'), 'properties', 'p1', 'requests', 'r1')));
    await assertFails(getDoc(doc(ctx('t2'), 'properties', 'p1', 'requests', 'r1')));
    await assertFails(getDoc(doc(ctx('owner2'), 'properties', 'p1', 'requests', 'r1')));
    await assertFails(updateDoc(doc(ctx('t1'), 'properties', 'p1', 'requests', 'r1'), { status: 'resolved', updatedAt: serverTimestamp() }));
    await assertFails(doc(ctx('t1'), 'properties', 'p1', 'requests', 'r1').delete());
    await assertSucceeds(updateDoc(doc(ctx('owner1'), 'properties', 'p1', 'requests', 'r1'), { status: 'in_progress', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx('owner1'), 'properties', 'p1', 'requests', 'r1'), { title: 'x', updatedAt: serverTimestamp() }));

    // After the check-out date, or once the membership is inactive, no new requests.
    await assertSucceeds(updateDoc(doc(ctx('owner1'), 'properties', 'p1', 'members', 't1'), { checkInAt: inFuture(-2 * day), checkOutAt: inFuture(-day) }));
    await assertFails(col('t1').doc('r9').set(req('t1')));
    await seed(async (db) => updateDoc(doc(db, 'properties', 'p1', 'members', 't1'), { checkOutAt: inFuture(day), status: 'inactive' }));
    await assertFails(col('t1').doc('r10').set(req('t1')));
  });

  it('lets a tenant request a stay with a Property ID, even for an unlisted property', async () => {
    const join = (uid: string, id = 'p2') => doc(ctx(uid), 'propertyJoin', id);
    // Only the property's owner creates the lookup record (p2 belongs to owner2); anyone verified reads it.
    await assertFails(setDoc(join('owner1'), { ownerUid: 'owner1', createdAt: serverTimestamp() }));
    await assertFails(setDoc(join('t1'), { ownerUid: 't1', createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(join('owner2'), { ownerUid: 'owner2', createdAt: serverTimestamp() }));
    await assertFails(updateDoc(join('owner2'), { ownerUid: 'owner1' }));
    await assertSucceeds(getDoc(join('t1')));

    const request = (extra: Record<string, unknown> = {}) => ({
      tenantUid: 't1', ownerUid: 'owner2', propertyId: 'p2', tenantName: 't1', status: 'pending',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
    });
    const ref = (uid: string) => doc(ctx(uid), 'properties', 'p2', 'stayRequests', uid);
    await assertFails(setDoc(ref('t1'), request({ ownerUid: 'owner1' }))); // owner must be the property's owner
    await assertSucceeds(setDoc(ref('t1'), request()));
  });

  it('lets tenants browse finished, active properties with their rooms and beds, and request a stay only at one', async () => {
    await seed(async (db) => {
      const now = Timestamp.now();
      await updateDoc(doc(db, 'properties', 'p1'), { setupStatus: 'ready' });
      await updateDoc(doc(db, 'properties', 'p2'), { setupStatus: 'ready', status: 'inactive' });
      for (const [property, owner] of [['p1', 'owner1'], ['p2', 'owner2']]) {
        await setDoc(doc(db, 'properties', property, 'rooms', 'r1'), { ownerUid: owner, propertyId: property, roomNumber: '101', sharing: 2, ac: false, updatedAt: now });
        await setDoc(doc(db, 'properties', property, 'rooms', 'r1', 'beds', 'b1'), { ownerUid: owner, propertyId: property, roomId: 'r1', label: 'Bed 1', status: 'available', updatedAt: now });
        await setDoc(doc(db, 'properties', property, 'bedAllocations', 'b1'), { ownerUid: owner, propertyId: property, roomId: 'r1', bedId: 'b1', residentId: 'x', residentName: 'Asha', createdAt: now });
      }
    });
    const properties = (uid: string) => ctx(uid).collection('properties');

    // A tenant lists finished properties (the query must say so), and reads one that is active.
    await assertSucceeds(properties('t1').where('setupStatus', '==', 'ready').get());
    await assertFails(properties('t1').get());
    await assertSucceeds(getDoc(doc(ctx('t1'), 'properties', 'p1')));
    await assertFails(getDoc(doc(ctx('t1'), 'properties', 'p2'))); // switched off

    // Rooms and beds of a browsable property are visible; the claims naming residents are not.
    await assertSucceeds(properties('t1').doc('p1').collection('rooms').get());
    await assertSucceeds(properties('t1').doc('p1').collection('rooms').doc('r1').collection('beds').get());
    await assertFails(properties('t1').doc('p2').collection('rooms').get());
    await assertFails(properties('t1').doc('p1').collection('bedAllocations').get());
    await assertFails(setDoc(doc(ctx('t1'), 'properties', 'p1', 'rooms', 'r2'), { ownerUid: 't1', propertyId: 'p1', roomNumber: '9', sharing: 1, ac: false, updatedAt: serverTimestamp() }));

    // Only the owner marks a bed occupied.
    const bed = (uid: string) => doc(ctx(uid), 'properties', 'p1', 'rooms', 'r1', 'beds', 'b1');
    await assertSucceeds(updateDoc(bed('owner1'), { occupied: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(bed('owner1'), { occupied: 'yes', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(bed('t1'), { occupied: false, updatedAt: serverTimestamp() }));

    // A request: own uid as the document id, pending, for a browsable property.
    const request = (tenant: string, extra: Record<string, unknown> = {}) => ({
      tenantUid: tenant, ownerUid: 'owner1', propertyId: 'p1', tenantName: tenant, status: 'pending',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
    });
    const ref = (uid: string, id = uid) => doc(ctx(uid), 'properties', 'p1', 'stayRequests', id);
    await assertSucceeds(setDoc(ref('t1'), request('t1', { message: 'Hello' })));
    await assertFails(setDoc(ref('t1', 'someone-else'), request('t1'))); // not keyed by own uid
    await assertFails(setDoc(doc(ctx('t2'), 'properties', 'p2', 'stayRequests', 't2'), request('t2', { propertyId: 'p2', ownerUid: 'owner2' }))); // unlisted
    await assertFails(setDoc(ref('t2'), request('t2', { status: 'approved' })));
    await assertFails(setDoc(ref('t2'), request('t2', { ownerUid: 'owner2' })));
    await assertFails(setDoc(ref('owner1'), request('owner1'))); // owners do not apply

    // Visibility and decisions.
    await assertSucceeds(getDoc(ref('t1')));
    await assertSucceeds(getDoc(doc(ctx('owner1'), 'properties', 'p1', 'stayRequests', 't1')));
    await assertFails(getDoc(doc(ctx('t2'), 'properties', 'p1', 'stayRequests', 't1')));
    await assertFails(getDoc(doc(ctx('owner2'), 'properties', 'p1', 'stayRequests', 't1')));
    await assertFails(updateDoc(ref('t1'), { status: 'approved', updatedAt: serverTimestamp() })); // cannot self-approve
    await assertSucceeds(updateDoc(ref('t1'), { status: 'withdrawn', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref('t1'), { status: 'approved', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref('t1'), { status: 'pending', message: 'Again', updatedAt: serverTimestamp() }));
    const ownerRef = doc(ctx('owner1'), 'properties', 'p1', 'stayRequests', 't1');
    await assertSucceeds(updateDoc(ownerRef, { status: 'approved', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ownerRef, { status: 'rejected', updatedAt: serverTimestamp() })); // already decided
    await assertFails(updateDoc(doc(ctx('owner2'), 'properties', 'p1', 'stayRequests', 't1'), { status: 'rejected', updatedAt: serverTimestamp() }));
    // Approval grants nothing: no membership appears and the tenant still cannot read tenant-only data.
    await assertFails(getDoc(doc(ctx('t2'), 'properties', 'p1', 'members', 't1')));
  });

  it('lets a declined stay request be sent again only after 7 days', async () => {
    await seed(async (db) => {
      const now = Timestamp.now();
      const eightDaysAgo = Timestamp.fromMillis(Date.now() - 8 * 86_400_000);
      const twoDaysAgo = Timestamp.fromMillis(Date.now() - 2 * 86_400_000);
      for (const [uid, at] of [['t4', eightDaysAgo], ['t5', twoDaysAgo]] as const) {
        await setDoc(doc(db, 'users', uid), { ...profile(uid, 'tenant'), createdAt: now, updatedAt: now });
        await setDoc(doc(db, 'properties', 'p1', 'stayRequests', uid), { tenantUid: uid, ownerUid: 'owner1', propertyId: 'p1', tenantName: uid, status: 'rejected', createdAt: at, updatedAt: at });
      }
    });
    const mine = (uid: string) => doc(ctx(uid), 'properties', 'p1', 'stayRequests', uid);
    await assertFails(updateDoc(mine('t5'), { status: 'pending', updatedAt: serverTimestamp() })); // declined 2 days ago
    await assertSucceeds(updateDoc(mine('t4'), { status: 'pending', message: 'Hello again', updatedAt: serverTimestamp() })); // declined 8 days ago
  });

  it('lets a location lock be created once, only by the property’s owner', async () => {
    const key = 'addr_0123456789abcd';
    const lock = (property: string) => ({ propertyId: property, createdAt: serverTimestamp() });
    const ref = (uid: string, id = key) => doc(ctx(uid), 'propertyLocations', id);
    await assertFails(setDoc(ref('t1'), lock('p1'))); // a tenant cannot claim
    await assertFails(setDoc(ref('owner1'), lock('p2'))); // not owner1's property
    await assertFails(setDoc(ref('owner1', 'bad_key'), lock('p1')));
    await assertFails(setDoc(ref('owner1'), { ...lock('p1'), extra: 1 }));
    await assertSucceeds(setDoc(ref('owner1'), lock('p1')));
    // Taken: nobody can claim it again or change it; anyone signed in can see it exists.
    await assertFails(setDoc(ref('owner2'), lock('p2')));
    await assertFails(setDoc(ref('owner1'), lock('p1')));
    await assertSucceeds(getDoc(ref('t1')));
    await assertSucceeds(getDoc(ref('owner2', 'addr_ffffffffffffff'))); // a free key can be checked
    await assertFails(ctx('owner1').collection('propertyLocations').get());
    // Only the owner of the locked property can release it.
    await assertFails(deleteDoc(ref('owner2')));
    await assertSucceeds(deleteDoc(ref('owner1')));
  });

  it('lets only the owner edit a property, and never change who owns it', async () => {
    const edit = (uid: string, id: string, data: Record<string, unknown>) =>
      updateDoc(doc(ctx(uid), 'properties', id), { ...data, updatedAt: serverTimestamp() });
    await assertSucceeds(edit('owner1', 'p1', { name: 'Renamed', amenities: ['wifi', 'meals'], description: 'New text' }));
    await assertFails(edit('owner2', 'p1', { name: 'Hijacked' })); // another owner
    await assertFails(edit('t1', 'p1', { name: 'Tenant edit' })); // a tenant
    await assertFails(edit('owner1', 'p2', { name: 'Not mine' })); // the other owner's property
    await assertFails(edit('owner1', 'p1', { ownerUid: 'owner2' })); // ownership is immutable
    await assertFails(edit('owner1', 'p1', { secretNotes: 'x' })); // only known fields
    await assertFails(edit('owner1', 'p1', { amenities: Array.from({ length: 21 }, (_, i) => String(i)) }));
    // Moving the property: its old lock is released and a new one claimed in one batch.
    const lock = (key: string) => doc(ctx('owner1'), 'propertyLocations', key);
    await assertSucceeds(setDoc(lock('addr_00000000000001'), { propertyId: 'p1', createdAt: serverTimestamp() }));
    const batch = writeBatch(ctx('owner1'));
    batch.update(doc(ctx('owner1'), 'properties', 'p1'), { location: 'New street', updatedAt: serverTimestamp() });
    batch.delete(lock('addr_00000000000001'));
    batch.set(lock('addr_00000000000002'), { propertyId: 'p1', createdAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
    await assertFails(deleteDoc(doc(ctx('owner2'), 'propertyLocations', 'addr_00000000000002'))); // not theirs to release
  });

  it('lets only a resident review a property, once, and only they can change or delete it', async () => {
    const review = (uid: string, extra: Record<string, unknown> = {}) => ({
      tenantUid: uid, propertyId: 'p1', tenantName: uid, rating: 4, comment: 'Clean rooms', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
    });
    const ref = (uid: string, id = uid) => doc(ctx(uid), 'properties', 'p1', 'reviews', id);
    await assertSucceeds(setDoc(ref('t1'), review('t1')));
    await assertFails(setDoc(ref('t2'), review('t2'))); // t2 is a member of p2, not p1
    await assertFails(setDoc(ref('owner1'), review('owner1'))); // owners do not review
    await assertFails(setDoc(ref('t1', 'someone-else'), review('t1'))); // not keyed by own uid
    await assertFails(setDoc(ref('t1', 'x'), review('t1', { rating: 5 })));
    await assertFails(setDoc(ref('t1'), review('t1', { rating: 6 }))); // out of range (and not a create)

    // Reading is open to signed-in users, including owners.
    await assertSucceeds(getDoc(ref('t2', 't1')));
    await assertSucceeds(getDoc(ref('owner2', 't1')));

    // Editing: own rating and comment only.
    await assertSucceeds(updateDoc(ref('t1'), { rating: 5, comment: 'Great', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref('t1'), { rating: 0, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref('t1'), { tenantName: 'Someone else', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx('t2'), 'properties', 'p1', 'reviews', 't1'), { rating: 1, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(ctx('owner1'), 'properties', 'p1', 'reviews', 't1'), { rating: 1, updatedAt: serverTimestamp() }));

    // Deleting: only the author.
    await assertFails(deleteDoc(doc(ctx('t2'), 'properties', 'p1', 'reviews', 't1')));
    await assertFails(deleteDoc(doc(ctx('owner1'), 'properties', 'p1', 'reviews', 't1')));
    await assertSucceeds(deleteDoc(ref('t1')));
  });

  it('closes reviews 30 days after the resident leaves', async () => {
    const day = 24 * 60 * 60 * 1000;
    const review = (extra: Record<string, unknown> = {}) => ({
      tenantUid: 't1', propertyId: 'p1', tenantName: 't1', rating: 4, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
    });
    const ref = () => doc(ctx('t1'), 'properties', 'p1', 'reviews', 't1');
    const leave = (daysAgo: number) =>
      seed(async (db) => updateDoc(doc(db, 'properties', 'p1', 'members', 't1'), { checkInAt: inFuture(-400 * day), checkOutAt: inFuture(-daysAgo * day) }));

    await assertSucceeds(setDoc(ref(), review())); // still staying (no check-out date)
    await leave(10); // left 10 days ago: inside the window
    await assertSucceeds(updateDoc(ref(), { rating: 5, updatedAt: serverTimestamp() }));
    await leave(40); // left 40 days ago: closed
    await assertFails(updateDoc(ref(), { rating: 3, updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref())); // removing their own review is still allowed
    await assertFails(setDoc(ref(), review())); // and a new one cannot be added
    await seed(async (db) => updateDoc(doc(db, 'properties', 'p1', 'members', 't1'), { checkOutAt: inFuture(-5 * day), status: 'inactive' }));
    await assertSucceeds(setDoc(ref(), review())); // left 5 days ago, even though inactive
    await seed(async (db) => updateDoc(doc(db, 'properties', 'p1', 'members', 't1'), { checkOutAt: firebase.firestore.FieldValue.delete() }));
    await assertSucceeds(deleteDoc(ref()));
    await assertFails(setDoc(ref(), review())); // inactive with no check-out date: counts as left
  });

  it('lets a tenant list only their own stay requests across properties', async () => {
    await seed(async (db) => {
      const now = Timestamp.now();
      for (const [property, owner, tenant] of [['p1', 'owner1', 't1'], ['p2', 'owner2', 't2']]) {
        await setDoc(doc(db, 'properties', property, 'stayRequests', tenant), {
          tenantUid: tenant, ownerUid: owner, propertyId: property, tenantName: tenant, status: 'pending', createdAt: now, updatedAt: now,
        });
      }
    });
    const mine = (uid: string) => ctx(uid).collectionGroup('stayRequests').where('tenantUid', '==', uid).get();
    expect((await assertSucceeds(mine('t1'))).size).toBe(1);
    expect((await assertSucceeds(mine('t2'))).size).toBe(1);
    // Asking for someone else's, or for all, is refused.
    await assertFails(ctx('t1').collectionGroup('stayRequests').where('tenantUid', '==', 't2').get());
    await assertFails(ctx('t1').collectionGroup('stayRequests').get());
    // The owner still decides, and the tenant then sees the change in the same query.
    await assertSucceeds(updateDoc(doc(ctx('owner1'), 'properties', 'p1', 'stayRequests', 't1'), { status: 'approved', updatedAt: serverTimestamp() }));
    const after = await assertSucceeds(mine('t1'));
    expect(after.docs[0].data().status).toBe('approved');
  });

  it('adds a tenant with a bed only together with approving their stay request', async () => {
    // owner1 owns p1 (seeded with rooms? this test seeds its own room and bed).
    await seed(async (db) => {
      const now = Timestamp.now();
      await setDoc(doc(db, 'properties', 'p1', 'rooms', 'r1'), { ownerUid: 'owner1', propertyId: 'p1', roomNumber: '101', sharing: 2, ac: false, updatedAt: now });
      await setDoc(doc(db, 'properties', 'p1', 'rooms', 'r1', 'beds', 'b1'), { ownerUid: 'owner1', propertyId: 'p1', roomId: 'r1', label: 'Bed 1', status: 'available', updatedAt: now });
      await setDoc(doc(db, 'properties', 'p1', 'stayRequests', 't3'), { tenantUid: 't3', ownerUid: 'owner1', propertyId: 'p1', tenantName: 't3', status: 'pending', createdAt: now, updatedAt: now });
      await setDoc(doc(db, 'users', 't3'), { ...profile('t3', 'tenant'), createdAt: now, updatedAt: now });
    });
    const owner = ctx('owner1');
    const refs = {
      resident: doc(owner, 'properties', 'p1', 'residents', 'res1'),
      allocation: doc(owner, 'properties', 'p1', 'bedAllocations', 'b1'),
      member: doc(owner, 'properties', 'p1', 'members', 't3'),
      request: doc(owner, 'properties', 'p1', 'stayRequests', 't3'),
    };
    const writes = (b: ReturnType<typeof writeBatch>, o: { approve: boolean; member: boolean; link: boolean }) => {
      b.set(refs.resident, {
        ownerUid: 'owner1', propertyId: 'p1', roomId: 'r1', bedId: 'b1', roomNumber: '101', bedLabel: 'Bed 1', sharing: 2, name: 't3', gender: 'male',
        phoneCountry: '+91', phone: '9876543210', rentInr: 5000, moveInDate: Timestamp.now(), status: 'active', createdAt: serverTimestamp(),
        ...(o.link ? { tenantUid: 't3' } : {}),
      });
      b.set(refs.allocation, { ownerUid: 'owner1', propertyId: 'p1', roomId: 'r1', bedId: 'b1', residentId: 'res1', residentName: 't3', createdAt: serverTimestamp() });
      if (o.approve) b.update(refs.request, { status: 'approved', updatedAt: serverTimestamp() });
      if (o.member) b.set(refs.member, { tenantUid: 't3', propertyId: 'p1', ownerUid: 'owner1', displayName: 't3', status: 'active', source: 'stay-request', checkInAt: Timestamp.now(), joinedAt: serverTimestamp() });
    };

    // A member without an approved request, or a link without a member, is refused.
    const noApprove = writeBatch(owner); writes(noApprove, { approve: false, member: true, link: true });
    await assertFails(noApprove.commit());
    const noMember = writeBatch(owner); writes(noMember, { approve: true, member: false, link: true });
    await assertFails(noMember.commit());
    // A tenant cannot make themselves a member, and another owner cannot add them.
    await assertFails(setDoc(doc(ctx('t3'), 'properties', 'p1', 'members', 't3'), { tenantUid: 't3', propertyId: 'p1', ownerUid: 'owner1', displayName: 't3', status: 'active', source: 'stay-request', joinedAt: serverTimestamp() }));
    const other = writeBatch(ctx('owner2'));
    other.set(doc(ctx('owner2'), 'properties', 'p1', 'members', 't3'), { tenantUid: 't3', propertyId: 'p1', ownerUid: 'owner2', displayName: 't3', status: 'active', source: 'stay-request', joinedAt: serverTimestamp() });
    await assertFails(other.commit());

    // Together, it works: the tenant is a resident with a bed, a member, and the request is approved.
    const good = writeBatch(owner); writes(good, { approve: true, member: true, link: true });
    await assertSucceeds(good.commit());
    expect((await getDoc(refs.request)).data()?.status).toBe('approved');
    await assertSucceeds(getDoc(doc(ctx('t3'), 'properties', 'p1', 'members', 't3')));
    await assertSucceeds(getDoc(doc(ctx('t3'), 'properties', 'p1')));
  });

  it('denies a disabled account all data access', async () => {
    await seed(async (db) => updateDoc(doc(db, 'users', 'owner1'), { status: 'disabled' }));
    await assertFails(getDoc(doc(ctx('owner1'), 'properties', 'p1')));
  });

  it('denies everything not explicitly allowed', async () => {
    await assertFails(getDoc(doc(ctx('owner1'), 'admins', 'owner1')));
    await assertFails(setDoc(doc(ctx('owner1'), 'admins', 'owner1'), { admin: true }));
  });
});

describe('phone matching (a registered tenant and a resident the owner added)', () => {
  const PHONE = '9876543210';
  const lookupRef = (uid: string, phone = PHONE, as = uid) => doc(ctx(as), 'tenantPhones', phone, 'accounts', uid);

  beforeEach(async () => {
    await seed(async (db) => {
      const now = Timestamp.now();
      await setDoc(doc(db, 'users', 'owner1'), { ...profile('owner1', 'owner'), createdAt: now, updatedAt: now });
      await setDoc(doc(db, 'users', 'owner2'), { ...profile('owner2', 'owner'), createdAt: now, updatedAt: now });
      await setDoc(doc(db, 'users', 't1'), { ...profile('t1', 'tenant'), createdAt: now, updatedAt: now });
      await setDoc(doc(db, 'users', 't2'), { ...profile('t2', 'tenant', { phone: '9000000002' }), createdAt: now, updatedAt: now });
      await setDoc(doc(db, 'properties', 'p1'), { ownerUid: 'owner1', name: 'Sunrise PG', setupStatus: 'ready', createdAt: now, updatedAt: now });
      // A resident the owner added by hand: same phone as t1, no account linked yet.
      await setDoc(doc(db, 'properties', 'p1', 'residents', 'res1'), {
        ownerUid: 'owner1', propertyId: 'p1', roomId: 'r1', bedId: 'b1', roomNumber: '101', bedLabel: 'Bed 1', sharing: 2,
        name: 'Rahul', gender: 'male', phoneCountry: '+91', phone: PHONE, rentInr: 5000, moveInDate: now, status: 'active', createdAt: now,
      });
    });
  });

  it('lets a tenant write only their own lookup, for the phone on their own profile', async () => {
    await assertSucceeds(setDoc(lookupRef('t1'), { uid: 't1', displayName: 't1' }));
    await assertFails(setDoc(lookupRef('t1', '9111111111'), { uid: 't1', displayName: 't1' })); // not their number
    await assertFails(setDoc(lookupRef('t1'), { uid: 't1', displayName: 'someone else' })); // name must match the profile
    await assertFails(setDoc(lookupRef('t1'), { uid: 't1', displayName: 't1', email: 't1@example.com' })); // nothing more than uid and name
    await assertFails(setDoc(doc(ctx('t2'), 'tenantPhones', PHONE, 'accounts', 't1'), { uid: 't1', displayName: 't1' })); // not their uid
    await assertFails(setDoc(lookupRef('owner1', PHONE, 'owner1'), { uid: 'owner1', displayName: 'owner1' })); // owners keep no lookup
  });

  it('lets several accounts share a number, and an owner read the accounts under a number', async () => {
    await seed(async (db) => updateDoc(doc(db, 'users', 't2'), { phone: PHONE }));
    await assertSucceeds(setDoc(lookupRef('t1'), { uid: 't1', displayName: 't1' }));
    await assertSucceeds(setDoc(lookupRef('t2'), { uid: 't2', displayName: 't2' }));
    const owner = await assertSucceeds(ctx('owner1').collection('tenantPhones').doc(PHONE).collection('accounts').get());
    expect(owner.size).toBe(2);
    await assertFails(ctx('t1').collection('tenantPhones').doc(PHONE).collection('accounts').get()); // tenants cannot list
    await assertSucceeds(getDoc(lookupRef('t1'))); // a tenant reads their own
    await assertFails(getDoc(doc(ctx('t2'), 'tenantPhones', PHONE, 'accounts', 't1')));
    await assertSucceeds(deleteDoc(lookupRef('t1')));
    await assertFails(deleteDoc(doc(ctx('t2'), 'tenantPhones', PHONE, 'accounts', 't1')));
  });

  const memberDoc = (extra: Record<string, unknown> = {}) => ({
    tenantUid: 't1', propertyId: 'p1', ownerUid: 'owner1', displayName: 't1', status: 'active', source: 'phone-match',
    residentId: 'res1', joinedAt: serverTimestamp(), ...extra,
  });
  const link = (uid: string, member: Record<string, unknown> = memberDoc(), resident: Record<string, unknown> = { tenantUid: 't1' }) => {
    const db = ctx(uid);
    const batch = writeBatch(db);
    batch.update(doc(db, 'properties', 'p1', 'residents', 'res1'), { ...resident, updatedAt: serverTimestamp() });
    batch.set(doc(db, 'properties', 'p1', 'members', 't1'), member);
    return batch.commit();
  };

  it('lets the owner link the resident to the matching account in one batch, and only then', async () => {
    await assertFails(link('owner1')); // the tenant has not published a lookup yet
    await assertSucceeds(setDoc(lookupRef('t1'), { uid: 't1', displayName: 't1' }));
    await assertFails(link('owner2')); // not this property's owner
    await assertFails(link('t1')); // a tenant cannot link themselves
    await assertFails(link('owner1', memberDoc({ source: 'stay-request' }))); // must say it was a phone match
    await assertFails(link('owner1', memberDoc({ displayName: 'Somebody Else' }))); // name comes from the lookup
    await assertFails(link('owner1', memberDoc({ residentId: 'nope' })));
    await assertFails(link('owner1', memberDoc(), { tenantUid: 't2' })); // resident and member must name the same tenant
    await assertSucceeds(link('owner1'));
    expect((await getDoc(doc(ctx('owner1'), 'properties', 'p1', 'residents', 'res1'))).data()?.tenantUid).toBe('t1');
    await assertFails(link('owner1')); // a resident already linked cannot be linked again
  });

  it('lets a tenant list only their own memberships across properties', async () => {
    await assertSucceeds(setDoc(lookupRef('t1'), { uid: 't1', displayName: 't1' }));
    await assertSucceeds(link('owner1'));
    const mine = await assertSucceeds(ctx('t1').collectionGroup('members').where('tenantUid', '==', 't1').get());
    expect(mine.size).toBe(1);
    await assertFails(ctx('t1').collectionGroup('members').where('tenantUid', '==', 't2').get());
    await assertFails(ctx('t2').collectionGroup('members').get());
  });

  it('lets an owner record, once, a match they declined', async () => {
    const ref = (uid: string, key = 'res1_t1') => doc(ctx(uid), 'users', uid, 'dismissedMatches', key);
    await assertSucceeds(setDoc(ref('owner1'), { createdAt: serverTimestamp() }));
    await assertFails(setDoc(ref('owner1'), { createdAt: serverTimestamp() })); // create-only
    await assertFails(setDoc(doc(ctx('owner2'), 'users', 'owner1', 'dismissedMatches', 'x'), { createdAt: serverTimestamp() }));
    await assertSucceeds(ctx('owner1').collection('users').doc('owner1').collection('dismissedMatches').get());
    await assertFails(ctx('owner2').collection('users').doc('owner1').collection('dismissedMatches').get());
  });
});

describe('resident phone markers (what tells a registering tenant their owner must confirm them)', () => {
  const PHONE = '9876543210';
  const entry = (uid: string, id = 'res1', phone = PHONE) => doc(ctx(uid), 'residentPhones', phone, 'entries', id);

  beforeEach(async () => {
    await seed(async (db) => {
      const now = Timestamp.now();
      for (const [uid, role] of [['owner1', 'owner'], ['owner2', 'owner'], ['t1', 'tenant']] as const) {
        await setDoc(doc(db, 'users', uid), { ...profile(uid, role), createdAt: now, updatedAt: now });
      }
    });
  });

  it('lets an owner create a marker for their own residents and delete it, and nobody else touch it', async () => {
    await assertSucceeds(setDoc(entry('owner1'), { ownerUid: 'owner1' }));
    await assertFails(setDoc(entry('owner1', 'res2'), { ownerUid: 'owner2' })); // must name themselves
    await assertFails(setDoc(entry('owner1', 'res3'), { ownerUid: 'owner1', propertyName: 'Sunrise PG' })); // nothing but ownerUid
    await assertFails(setDoc(entry('owner1', 'res4', '12345'), { ownerUid: 'owner1' })); // ten digits only
    await assertFails(setDoc(entry('t1', 'res5'), { ownerUid: 't1' })); // tenants cannot create markers
    await assertFails(deleteDoc(doc(ctx('owner2'), 'residentPhones', PHONE, 'entries', 'res1')));
    await assertSucceeds(deleteDoc(entry('owner1')));
  });

  it('lets a tenant learn only that a marker exists for a number, and the owner record which accounts are not them', async () => {
    await assertSucceeds(setDoc(entry('owner1'), { ownerUid: 'owner1' }));
    const seen = await assertSucceeds(ctx('t1').collection('residentPhones').doc(PHONE).collection('entries').get());
    expect(seen.size).toBe(1);
    await assertFails(updateDoc(entry('t1'), { dismissed: ['t1'] })); // a tenant cannot edit it
    await assertSucceeds(updateDoc(entry('owner1'), { dismissed: ['t1'] }));
    await assertFails(updateDoc(entry('owner1'), { ownerUid: 'owner2' })); // only `dismissed` may change
    await assertFails(updateDoc(doc(ctx('owner2'), 'residentPhones', PHONE, 'entries', 'res1'), { dismissed: [] }));
  });
});

describe('a tenant saying the number is not theirs', () => {
  const PHONE = '9876543210';
  const decline = (uid: string, id = 'res1', phone = PHONE) => doc(ctx(uid), 'residentPhones', phone, 'entries', id, 'declines', uid);

  beforeEach(async () => {
    await seed(async (db) => {
      const now = Timestamp.now();
      for (const [uid, role, extra] of [['owner1', 'owner', {}], ['owner2', 'owner', {}], ['t1', 'tenant', {}], ['t2', 'tenant', { phone: '9000000002' }]] as const) {
        await setDoc(doc(db, 'users', uid), { ...profile(uid, role, extra), createdAt: now, updatedAt: now });
      }
      await setDoc(doc(db, 'properties', 'p1'), { ownerUid: 'owner1', name: 'Sunrise PG', setupStatus: 'ready', createdAt: now, updatedAt: now });
      await setDoc(doc(db, 'properties', 'p1', 'residents', 'res1'), {
        ownerUid: 'owner1', propertyId: 'p1', roomId: 'r1', bedId: 'b1', roomNumber: '101', bedLabel: 'Bed 1', sharing: 2,
        name: 'Rahul', gender: 'male', phoneCountry: '+91', phone: PHONE, rentInr: 5000, moveInDate: now, status: 'active', createdAt: now,
      });
      await setDoc(doc(db, 'residentPhones', PHONE, 'entries', 'res1'), { ownerUid: 'owner1' });
      await setDoc(doc(db, 'tenantPhones', PHONE, 'accounts', 't1'), { uid: 't1', displayName: 't1' });
    });
  });

  it('lets a tenant decline once, only for their own number and a marker that exists', async () => {
    await assertFails(setDoc(decline('t2'), { uid: 't2', createdAt: serverTimestamp() })); // not their number
    await assertFails(setDoc(decline('t1', 'nope'), { uid: 't1', createdAt: serverTimestamp() })); // no such marker
    await assertFails(setDoc(decline('t1'), { uid: 't1', createdAt: serverTimestamp(), note: 'x' })); // nothing extra
    await assertFails(setDoc(decline('owner1', 'res1'), { uid: 'owner1', createdAt: serverTimestamp() })); // owners do not decline
    await assertSucceeds(setDoc(decline('t1'), { uid: 't1', createdAt: serverTimestamp() }));
    await assertFails(setDoc(decline('t1'), { uid: 't1', createdAt: serverTimestamp() })); // final
    await assertFails(deleteDoc(decline('t1')));
    await assertSucceeds(getDoc(decline('t1'))); // the tenant can see their own
  });

  it('lets only the resident’s owner read the declines', async () => {
    await assertSucceeds(setDoc(decline('t1'), { uid: 't1', createdAt: serverTimestamp() }));
    const list = (uid: string) => ctx(uid).collection('residentPhones').doc(PHONE).collection('entries').doc('res1').collection('declines').get();
    expect((await assertSucceeds(list('owner1'))).size).toBe(1);
    await assertFails(list('owner2'));
    await assertFails(list('t1'));
  });

  it('stops the owner linking an account that declined that resident', async () => {
    const member = { tenantUid: 't1', propertyId: 'p1', ownerUid: 'owner1', displayName: 't1', status: 'active', source: 'phone-match', residentId: 'res1', joinedAt: serverTimestamp() };
    const link = () => {
      const db = ctx('owner1');
      const batch = writeBatch(db);
      batch.update(doc(db, 'properties', 'p1', 'residents', 'res1'), { tenantUid: 't1', updatedAt: serverTimestamp() });
      batch.set(doc(db, 'properties', 'p1', 'members', 't1'), member);
      return batch.commit();
    };
    await assertSucceeds(setDoc(decline('t1'), { uid: 't1', createdAt: serverTimestamp() }));
    await assertFails(link());
  });
});
