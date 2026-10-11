'use client';

/**
 * Client component: it holds React state and/or wraps a Radix primitive, so it
 * must sit on the client side of the App Router boundary. Server components can
 * still render it — the directive only marks where the boundary is.
 */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '@vunvault/lib';
import { Label } from './label';

/**
 * React Hook Form wiring (the shadcn context pattern).
 *
 * Form *values* live in RHF state only — never in `useState`. Every control gets
 * a stable id plus `aria-invalid` / `aria-describedby` from `FormControl`, so a
 * screen reader announces the description and then the error for the focused field.
 */

export const Form = FormProvider;

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

export type FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = ControllerProps<TFieldValues, TName>;

/** Binds an RHF `Controller` to the field context used by the items below. */
export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: FormFieldProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

interface FormItemContextValue {
  id: string;
}

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

/** Read the ids and validation state of the field you are rendering inside. */
export function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (!fieldContext.name) {
    throw new Error('useFormField must be used inside <FormField>.');
  }

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

export type FormItemProps = React.HTMLAttributes<HTMLDivElement>;

/** Grid wrapper that owns the generated id every control and message hangs off. */
export function FormItem({ className, ...props }: FormItemProps) {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn('grid gap-1.5', className)} {...props} />
    </FormItemContext.Provider>
  );
}

export type FormLabelProps = React.ComponentPropsWithoutRef<typeof Label>;

/** Field label; turns critical when the field currently has an error. */
export function FormLabel({ className, ...props }: FormLabelProps) {
  const { error, formItemId } = useFormField();

  return (
    <Label htmlFor={formItemId} className={cn(error && 'text-critical', className)} {...props} />
  );
}

export type FormControlProps = React.ComponentPropsWithoutRef<typeof Slot>;

/** Injects `id`, `aria-invalid` and `aria-describedby` into the rendered control. */
export function FormControl({ ...props }: FormControlProps) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot
      id={formItemId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      {...props}
    />
  );
}

export type FormDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

/** Helper copy under a field, e.g. `"@vunvault.com domain"`. */
export function FormDescription({ className, ...props }: FormDescriptionProps) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      id={formDescriptionId}
      className={cn('text-[0.72rem] text-ink-muted', className)}
      {...props}
    />
  );
}

export type FormMessageProps = React.HTMLAttributes<HTMLParagraphElement>;

/** Validation message. Renders nothing at all when the field is valid. */
export function FormMessage({ className, children, ...props }: FormMessageProps) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message ?? '') : children;

  if (!body) return null;

  return (
    <p
      id={formMessageId}
      role="alert"
      className={cn('text-[0.72rem] font-semibold text-critical', className)}
      {...props}
    >
      {body}
    </p>
  );
}
