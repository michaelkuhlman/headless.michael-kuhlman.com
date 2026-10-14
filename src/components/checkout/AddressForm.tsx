'use client';

import type { Region } from '@/lib/magento/catalog';
import type { CartAddress } from '@/lib/client/cart';

/** Address fields shared by checkout (shipping + billing) and the account address book. US only, like the store. */

export interface Addr {
  firstname: string;
  lastname: string;
  company: string;
  street1: string;
  street2: string;
  city: string;
  region_id: string;
  postcode: string;
  telephone: string;
}

export const emptyAddr: Addr = { firstname: '', lastname: '', company: '', street1: '', street2: '', city: '', region_id: '', postcode: '', telephone: '' };

export function fromCart(a: (Partial<CartAddress> & { region?: { region_id?: number | null } | null }) | null | undefined): Addr {
  if (!a) return { ...emptyAddr };
  return {
    firstname: a.firstname ?? '',
    lastname: a.lastname ?? '',
    company: a.company ?? '',
    street1: a.street?.[0] ?? '',
    street2: a.street?.[1] ?? '',
    city: a.city ?? '',
    region_id: a.region?.region_id ? String(a.region.region_id) : '',
    postcode: a.postcode ?? '',
    telephone: a.telephone ?? '',
  };
}

/** CartAddressInput for setShippingAddressesOnCart / setBillingAddressOnCart. */
export function toCartInput(a: Addr) {
  return {
    firstname: a.firstname.trim(),
    lastname: a.lastname.trim(),
    company: a.company.trim() || undefined,
    street: [a.street1.trim(), a.street2.trim()].filter(Boolean),
    city: a.city.trim(),
    region_id: Number(a.region_id) || undefined,
    postcode: a.postcode.trim(),
    country_code: 'US',
    telephone: a.telephone.trim(),
    save_in_address_book: false,
  };
}

export type AddrErrors = Partial<Record<keyof Addr, string>>;

const REQ = 'This is a required field.';
export function validateAddr(a: Addr): AddrErrors {
  const e: AddrErrors = {};
  for (const k of ['firstname', 'lastname', 'street1', 'city', 'region_id', 'postcode', 'telephone'] as const) if (!a[k].trim()) e[k] = REQ;
  if (a.postcode.trim() && !/^\d{5}(-\d{4})?$/.test(a.postcode.trim())) e.postcode = 'Please enter a valid ZIP code, for example 92101.';
  if (a.telephone.trim() && a.telephone.replace(/\D/g, '').length < 7) e.telephone = 'Please enter a valid phone number.';
  return e;
}

export function regionName(regions: Region[], id: string) {
  return regions.find((r) => String(r.id) === id)?.name ?? '';
}

export function AddressView({ a, regions }: { a: Addr; regions: Region[] }) {
  return (
    <address className="ts-addr-view">
      {a.firstname} {a.lastname}
      <br />
      {a.company && (
        <>
          {a.company}
          <br />
        </>
      )}
      {a.street1}
      {a.street2 && `, ${a.street2}`}
      <br />
      {a.city}, {regionName(regions, a.region_id)} {a.postcode}
      <br />
      United States
      <br />
      {a.telephone}
    </address>
  );
}

function F({
  id,
  label,
  k,
  a,
  set,
  err,
  req = true,
  half = false,
  ...rest
}: {
  id: string;
  label: string;
  k: keyof Addr;
  a: Addr;
  set: (a: Addr) => void;
  err: AddrErrors;
  req?: boolean;
  half?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`ts-field${req ? ' is-required' : ''}${half ? ' ts-field--half' : ''}`}>
      <label htmlFor={`${id}-${k}`}>{label}</label>
      <input
        id={`${id}-${k}`}
        type="text"
        value={a[k]}
        aria-invalid={!!err[k]}
        aria-describedby={err[k] ? `${id}-${k}-err` : undefined}
        onChange={(e) => set({ ...a, [k]: e.target.value })}
        {...rest}
      />
      {err[k] && (
        <p className="ts-field-error" id={`${id}-${k}-err`}>
          {err[k]}
        </p>
      )}
    </div>
  );
}

export function AddressFields({ id, a, set, err, regions }: { id: string; a: Addr; set: (a: Addr) => void; err: AddrErrors; regions: Region[] }) {
  const ac = id === 'bill' ? 'billing' : 'shipping';
  return (
    <div className="ts-addr">
      <F id={id} label="First name" k="firstname" a={a} set={set} err={err} half autoComplete={`${ac} given-name`} />
      <F id={id} label="Last name" k="lastname" a={a} set={set} err={err} half autoComplete={`${ac} family-name`} />
      <F id={id} label="Company" k="company" a={a} set={set} err={err} req={false} autoComplete={`${ac} organization`} />
      <div className="ts-field is-required ts-addr__street">
        <label htmlFor={`${id}-street1`}>Street address</label>
        <input
          id={`${id}-street1`}
          type="text"
          value={a.street1}
          aria-invalid={!!err.street1}
          aria-describedby={err.street1 ? `${id}-street1-err` : undefined}
          onChange={(e) => set({ ...a, street1: e.target.value })}
          autoComplete={`${ac} address-line1`}
        />
        <input
          type="text"
          value={a.street2}
          aria-label="Street address line 2"
          onChange={(e) => set({ ...a, street2: e.target.value })}
          autoComplete={`${ac} address-line2`}
          style={{ marginTop: 10 }}
        />
        {err.street1 && (
          <p className="ts-field-error" id={`${id}-street1-err`}>
            {err.street1}
          </p>
        )}
      </div>
      <div className="ts-field is-required ts-field--half">
        <label htmlFor={`${id}-country`}>Country</label>
        <select id={`${id}-country`} value="US" disabled>
          <option value="US">United States</option>
        </select>
      </div>
      <div className="ts-field is-required ts-field--half">
        <label htmlFor={`${id}-region_id`}>State/Province</label>
        <select id={`${id}-region_id`} value={a.region_id} aria-invalid={!!err.region_id} aria-describedby={err.region_id ? `${id}-region_id-err` : undefined} onChange={(e) => set({ ...a, region_id: e.target.value })} autoComplete={`${ac} address-level1`}>
          <option value="">Please select a region, state or province.</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {err.region_id && (
          <p className="ts-field-error" id={`${id}-region_id-err`}>
            {err.region_id}
          </p>
        )}
      </div>
      <F id={id} label="City" k="city" a={a} set={set} err={err} half autoComplete={`${ac} address-level2`} />
      <F id={id} label="ZIP / postal code" k="postcode" a={a} set={set} err={err} half inputMode="numeric" autoComplete={`${ac} postal-code`} />
      <F id={id} label="Phone number" k="telephone" a={a} set={set} err={err} type="tel" autoComplete={`${ac} tel`} />
    </div>
  );
}
