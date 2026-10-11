// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search } from 'lucide-react';
import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from './button';
import { Checkbox } from './checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form';
import { Input, Textarea } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Switch } from './switch';

const TEAMS = [
  'Offensive Security',
  'SOC — Detection & Response',
  'Threat Intelligence',
  'Security Automation',
  'Compliance & Audit',
  'Client Support',
];

/** jsdom lacks the pointer-capture, scroll and resize APIs Radix relies on. */
beforeAll(() => {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

describe('Label', () => {
  it('renders the field label and links to its control', () => {
    render(
      <>
        <Label htmlFor="full-name">Full Name</Label>
        <Input id="full-name" />
      </>,
    );
    const label = screen.getByText('Full Name');
    expect(label).toHaveAttribute('for', 'full-name');
    expect(label).toHaveClass('uppercase', 'tracking-[0.14em]', 'text-ink-faint');
    expect(screen.getByLabelText(/Full Name/)).toBeInTheDocument();
  });

  it('marks a required field with a decorative asterisk', () => {
    render(<Label required>Full Name</Label>);
    const label = screen.getByText('Full Name');
    const asterisk = label.querySelector('[aria-hidden="true"]');
    expect(asterisk).not.toBeNull();
    expect(asterisk).toHaveClass('text-critical');
    expect(asterisk).toHaveTextContent('*');
    expect(label).toHaveTextContent('Full Name *');
    // The asterisk is decorative and hidden from assistive technology, so a
    // screen reader announces the field name only.
    expect(asterisk).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Input', () => {
  it('renders the field surface', () => {
    render(<Input aria-label="Job Title" />);
    expect(screen.getByLabelText('Job Title')).toHaveClass('rounded-field', 'border-line');
  });

  it('renders a decorative leading icon and keeps the accessible name', () => {
    render(<Input icon={<Search size={14} data-testid="search-icon" />} aria-label="Search" />);
    const input = screen.getByLabelText('Search');
    expect(input).toHaveClass('pl-[38px]');
    const icon = screen.getByTestId('search-icon');
    expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(icon.closest('[aria-hidden="true"]')).toHaveClass('left-[13px]', 'pointer-events-none');
  });

  it('shows the critical ring when invalid and dims when disabled', () => {
    render(
      <>
        <Input aria-label="Work Email" aria-invalid="true" />
        <Input aria-label="Base / Location" disabled />
      </>,
    );
    expect(screen.getByLabelText('Work Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Work Email').className).toContain(
      'aria-[invalid=true]:border-critical',
    );
    expect(screen.getByLabelText('Base / Location')).toBeDisabled();
  });

  it('accepts typing', async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Job Title" />);
    await user.type(screen.getByLabelText('Job Title'), 'Security Analyst');
    expect(screen.getByLabelText('Job Title')).toHaveValue('Security Analyst');
  });
});

describe('Textarea', () => {
  it('renders a resizable multi-line field bound to its label', () => {
    render(
      <>
        <Label htmlFor="scope-notes">Scope Notes</Label>
        <p className="text-[0.72rem] text-ink-muted">Visible to reviewers only</p>
        <Textarea id="scope-notes" />
      </>,
    );
    const textarea = screen.getByLabelText('Scope Notes');
    expect(textarea).toHaveClass('min-h-24', 'resize-y', 'rounded-field');
    expect(screen.getByText('Visible to reviewers only')).toHaveClass('text-ink-muted');
  });
});

describe('Select', () => {
  it('opens the listbox and selects an option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger aria-label="Team">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TEAMS.map((team) => (
            <SelectItem key={team} value={team}>
              {team}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Team' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('Threat Intelligence')).toBeInTheDocument();
    expect(within(listbox).getAllByRole('option')).toHaveLength(TEAMS.length);

    await user.click(within(listbox).getByText('Threat Intelligence'));
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('Threat Intelligence'));
    expect(trigger).toHaveTextContent('Threat Intelligence');
  });
});

describe('Checkbox', () => {
  it('toggles and reports its state to assistive technology', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Select row" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Select row' });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(checkbox.className).toContain('data-[state=checked]:bg-brand');
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('is keyboard operable and renders the indeterminate dash', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Select all rows" checked="indeterminate" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(checkbox).toHaveAttribute('data-state', 'indeterminate');
    expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    checkbox.focus();
    await user.keyboard('{Space}');
    expect(checkbox).toHaveFocus();
  });
});

describe('Switch', () => {
  it('toggles between off and on', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Enforce MFA" onCheckedChange={onCheckedChange} />);
    const toggle = screen.getByRole('switch', { name: 'Enforce MFA' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveClass('bg-line');
    await user.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(toggle).toBeChecked();
    expect(toggle.className).toContain('data-[state=checked]:bg-brand');
  });
});

const provisionSchema = z.object({
  fullName: z.string().min(2, "Enter the member's full name"),
  email: z.string().email('Enter a valid work email'),
});

type ProvisionValues = z.infer<typeof provisionSchema>;

function ProvisionForm({ onSubmit }: { onSubmit: (values: ProvisionValues) => void }) {
  const form = useForm<ProvisionValues>({
    resolver: zodResolver(provisionSchema),
    defaultValues: { fullName: '', email: '' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Full Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Work Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>@vunvault.com domain</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Send Secure Invitation</Button>
      </form>
    </Form>
  );
}

describe('Form (React Hook Form + Zod)', () => {
  it('reports every Zod issue in an alert and does not submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ProvisionForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Send Secure Invitation' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent("Enter the member's full name");
    expect(alerts[1]).toHaveTextContent('Enter a valid work email');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('wires label, control, description and message to the same field', async () => {
    const user = userEvent.setup();
    render(<ProvisionForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Send Secure Invitation' }));

    const email = await screen.findByLabelText('Work Email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    const describedBy = (email.getAttribute('aria-describedby') ?? '').split(' ');
    expect(describedBy).toHaveLength(2);
    const [descriptionId, messageId] = describedBy as [string, string];
    expect(document.getElementById(descriptionId)).toHaveTextContent('@vunvault.com domain');
    expect(document.getElementById(messageId)).toHaveTextContent('Enter a valid work email');
    expect(screen.getByText('Work Email').closest('label')).toHaveClass('text-critical');
  });

  it('submits once the values satisfy the schema', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ProvisionForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/Full Name/), 'Aisha Mohamed');
    await user.type(screen.getByLabelText('Work Email'), 'a.mohamed@vunvault.com');
    await user.click(screen.getByRole('button', { name: 'Send Secure Invitation' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      { fullName: 'Aisha Mohamed', email: 'a.mohamed@vunvault.com' },
      expect.anything(),
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });
});
