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

  it('keeps properties scoped to their owner (and their members)', async () => {
    await assertSucceeds(getDoc(doc(ctx('owner1'), 'properties', 'p1')));
    await assertFails(getDoc(doc(ctx('owner1'), 'properties', 'p2')));
    await assertSucceeds(getDoc(doc(ctx('t1'), 'properties', 'p1')));
    await assertFails(getDoc(doc(ctx('t1'), 'properties', 'p2')));
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

  it('denies a disabled account all data access', async () => {
    await seed(async (db) => updateDoc(doc(db, 'users', 'owner1'), { status: 'disabled' }));
    await assertFails(getDoc(doc(ctx('owner1'), 'properties', 'p1')));
  });

  it('denies everything not explicitly allowed', async () => {
    await assertFails(getDoc(doc(ctx('owner1'), 'admins', 'owner1')));
    await assertFails(setDoc(doc(ctx('owner1'), 'admins', 'owner1'), { admin: true }));
  });
});
