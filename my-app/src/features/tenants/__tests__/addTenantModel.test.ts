import { isEditDirty, normalizePhone, parseDeposit, toNewResident, toResidentEdit, validateAddTenant, validateEditTenant, type AddTenantForm, type EditTenantForm, prefillFromRequest } from '@/features/tenants/addTenantModel';

const NOW = new Date(2026, 9, 20, 12).getTime();
const valid: AddTenantForm = {
  name: ' Rahul Sharma ',
  gender: 'male',
  phone: '98765 43210',
  email: '',
  address: '',
  emergencyName: '',
  emergencyPhone: '',
  propertyId: 'p1',
  roomId: 'r1',
  bedId: 'b1',
  rent: '6,000',
  deposit: '',
  moveInMs: NOW,
};

describe('validateAddTenant', () => {
  it('accepts the minimal valid form', () => {
    expect(validateAddTenant(valid, NOW)).toEqual({});
  });
  it('requires name, phone, property, room, bed and rent', () => {
    const e = validateAddTenant({ ...valid, name: ' ', gender: null, phone: '', propertyId: null, roomId: null, bedId: null, rent: '' }, NOW);
    expect(Object.keys(e).sort()).toEqual(['bed', 'gender', 'name', 'phone', 'property', 'rent', 'room']);
  });
  it('validates phone, email, deposit and move-in date when given', () => {
    expect(validateAddTenant({ ...valid, phone: '12345' }, NOW).phone).toBeDefined();
    expect(validateAddTenant({ ...valid, email: 'nope' }, NOW).email).toBeDefined();
    expect(validateAddTenant({ ...valid, deposit: '-5' }, NOW).deposit).toBeDefined();
    expect(validateAddTenant({ ...valid, deposit: '0' }, NOW).deposit).toBeUndefined();
    expect(validateAddTenant({ ...valid, moveInMs: NOW + 3 * 366 * 86_400_000 }, NOW).moveIn).toBeDefined();
  });
  it('wants both emergency fields or neither', () => {
    expect(validateAddTenant({ ...valid, emergencyName: 'Suresh' }, NOW).emergency).toBeDefined();
    expect(validateAddTenant({ ...valid, emergencyPhone: '9876543210' }, NOW).emergency).toBeDefined();
    expect(validateAddTenant({ ...valid, emergencyName: 'Suresh', emergencyPhone: '123' }, NOW).emergencyPhone).toBeDefined();
    expect(validateAddTenant({ ...valid, emergencyName: 'Suresh', emergencyPhone: '9876543210' }, NOW)).toEqual({});
  });
});

describe('shaping', () => {
  it('normalizes phone and deposit', () => {
    expect(normalizePhone('98765-43210')).toBe('9876543210');
    expect(normalizePhone('+919876543210')).toBeNull();
    expect(parseDeposit('12,000')).toBe(12000);
    expect(parseDeposit('')).toBeNull();
  });
  it('produces clean stored values', () => {
    const r = toNewResident({ ...valid, email: ' A@B.CO ', deposit: '12,000' });
    expect(r).toMatchObject({ name: 'Rahul Sharma', phone: '9876543210', email: 'a@b.co', rentInr: 6000, depositInr: 12000, address: null });
  });
});

describe('edit tenant', () => {
  const saved: EditTenantForm = { name: 'Rahul Sharma', phone: '9876543210', email: 'r@x.co', address: 'Hyderabad', emergencyName: 'Suresh', emergencyPhone: '9876501234' };
  it('accepts saved values and rejects bad ones', () => {
    expect(validateEditTenant(saved)).toEqual({});
    expect(validateEditTenant({ ...saved, name: ' ' }).name).toBeDefined();
    expect(validateEditTenant({ ...saved, phone: '123' }).phone).toBeDefined();
    expect(validateEditTenant({ ...saved, email: 'nope' }).email).toBeDefined();
    expect(validateEditTenant({ ...saved, emergencyPhone: '' }).emergency).toBeDefined();
    expect(validateEditTenant({ ...saved, email: '', address: '', emergencyName: '', emergencyPhone: '' })).toEqual({});
  });
  it('turns cleared optional fields into nulls', () => {
    expect(toResidentEdit({ ...saved, email: ' ', address: '', emergencyName: '', emergencyPhone: '' })).toEqual({
      name: 'Rahul Sharma',
      phone: '9876543210',
      email: null,
      address: null,
      emergencyName: null,
      emergencyPhone: null,
    });
  });
  it('detects unsaved changes ignoring formatting only', () => {
    expect(isEditDirty(saved, saved)).toBe(false);
    expect(isEditDirty({ ...saved, phone: '98765 43210', name: ' Rahul Sharma ' }, saved)).toBe(false);
    expect(isEditDirty({ ...saved, address: 'Pune' }, saved)).toBe(true);
  });
});

describe('prefillFromRequest', () => {
  it('prefills the name and the last 10 digits of the phone', () => {
    expect(prefillFromRequest(' Asha Rao ', '+91 98765 43210')).toEqual({ name: 'Asha Rao', phone: '9876543210' });
    expect(prefillFromRequest('Asha', '12345')).toEqual({ name: 'Asha', phone: '' });
    expect(prefillFromRequest(null, null)).toEqual({ name: '', phone: '' });
  });
});
