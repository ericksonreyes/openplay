import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResourceForm, buildAttrs, validateFields, type FieldDef } from './CrudPage';

const fields: FieldDef[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'capacity', label: 'Capacity', type: 'number' },
  { name: 'active', label: 'Active', type: 'checkbox' },
];

describe('validateFields', () => {
  it('flags missing required values', () => {
    expect(validateFields(fields, { name: '', capacity: '', active: false })).toEqual([
      'Name is required.',
    ]);
    expect(validateFields(fields, { name: 'Court 1', capacity: '', active: false })).toEqual([]);
  });
});

describe('buildAttrs', () => {
  it('casts numbers and booleans, trims strings, drops blanks', () => {
    expect(buildAttrs(fields, { name: '  Court 1 ', capacity: '4', active: true })).toEqual({
      name: 'Court 1',
      capacity: 4,
      active: true,
    });
  });
});

describe('ResourceForm', () => {
  function fill(name: string, value: string) {
    fireEvent.change(screen.getByLabelText(new RegExp(`^${name}`)), { target: { value } });
  }

  it('blocks submit and shows validation errors when required fields are empty', async () => {
    const onSubmit = vi.fn();
    render(
      <ResourceForm
        fields={fields}
        submitLabel="Create"
        busy={false}
        onSubmit={onSubmit}
        onCancel={() => undefined}
      />,
    );

    fireEvent.submit(screen.getByRole('button', { name: 'Create' }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits cleaned attributes when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ResourceForm
        fields={fields}
        submitLabel="Create"
        busy={false}
        onSubmit={onSubmit}
        onCancel={() => undefined}
      />,
    );

    fill('Name', 'Court 2');
    fill('Capacity', '6');
    fireEvent.submit(screen.getByRole('button', { name: 'Create' }).closest('form')!);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Court 2', capacity: 6, active: false }),
    );
  });
});
