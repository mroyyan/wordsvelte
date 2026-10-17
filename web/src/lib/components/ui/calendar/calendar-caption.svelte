<script lang="ts">
	import { DateFormatter, getLocalTimeZone, type DateValue } from "@internationalized/date";
	import * as Select from "$lib/components/ui/select";
	import type Calendar from "./calendar.svelte";
	import type { ComponentProps } from "svelte";

	/**
	 * The month/year heading. The dropdown layouts use the Select component (a popover list that matches the rest of the
	 * UI) instead of native <select> elements.
	 */
	let {
		captionLayout,
		monthFormat,
		years,
		yearFormat,
		month,
		locale,
		placeholder = $bindable(),
		monthIndex = 0,
	}: {
		captionLayout: ComponentProps<typeof Calendar>["captionLayout"];
		months?: unknown;
		monthFormat: "short" | "long" | "narrow" | "numeric" | "2-digit" | ((month: number) => string) | undefined;
		/** Years to offer; defaults to five years back and ten ahead of today (the shown year is always included). */
		years?: number[] | { value: number; label?: string }[] | unknown;
		yearFormat: "numeric" | "2-digit" | ((year: number) => string) | undefined;
		month: DateValue;
		placeholder: DateValue | undefined;
		locale: string;
		monthIndex?: number;
	} = $props();

	const toDate = (d: DateValue) => d.toDate(getLocalTimeZone());

	function formatMonth(m: number) {
		if (typeof monthFormat === "function") return monthFormat(m);
		return new DateFormatter(locale, { month: monthFormat ?? "short" }).format(new Date(2000, m - 1, 1));
	}

	function formatYear(y: number) {
		if (typeof yearFormat === "function") return yearFormat(y);
		return new DateFormatter(locale, { year: yearFormat ?? "numeric" }).format(new Date(y, 5, 1));
	}

	const monthItems = $derived(Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: formatMonth(i + 1) })));

	const yearItems = $derived.by(() => {
		let list: number[];
		if (Array.isArray(years) && years.length) {
			list = (years as any[]).map((y) => (typeof y === "number" ? y : y.value));
		} else {
			const now = new Date().getFullYear();
			list = Array.from({ length: 16 }, (_, i) => now - 5 + i);
		}
		if (!list.includes(month.year)) list = [...list, month.year].sort((a, b) => a - b);
		return list.map((y) => ({ value: String(y), label: formatYear(y) }));
	});

	function setMonth(v: string) {
		if (!placeholder) return;
		placeholder = placeholder.set({ month: Number.parseInt(v) }).subtract({ months: monthIndex });
	}

	function setYear(v: string) {
		if (!placeholder) return;
		placeholder = placeholder.set({ year: Number.parseInt(v) });
	}
</script>

{#snippet MonthSelect()}
	<Select.Root type="single" value={String(month.month)} onValueChange={setMonth}>
		<Select.Trigger size="sm" class="w-auto min-w-0 gap-1 px-2" aria-label="Month">
			{monthItems.find((i) => i.value === String(month.month))?.label}
		</Select.Trigger>
		<Select.Content class="max-h-64">
			{#each monthItems as item (item.value)}
				<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
{/snippet}

{#snippet YearSelect()}
	<Select.Root type="single" value={String(month.year)} onValueChange={setYear}>
		<Select.Trigger size="sm" class="w-auto min-w-0 gap-1 px-2" aria-label="Year">
			{formatYear(month.year)}
		</Select.Trigger>
		<Select.Content class="max-h-64">
			{#each yearItems as item (item.value)}
				<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
{/snippet}

{#if captionLayout === "dropdown"}
	{@render MonthSelect()}
	{@render YearSelect()}
{:else if captionLayout === "dropdown-months"}
	{@render MonthSelect()}
	{#if placeholder}
		{formatYear(placeholder.year)}
	{/if}
{:else if captionLayout === "dropdown-years"}
	{#if placeholder}
		{formatMonth(placeholder.month)}
	{/if}
	{@render YearSelect()}
{:else}
	{formatMonth(month.month)} {formatYear(month.year)}
{/if}
