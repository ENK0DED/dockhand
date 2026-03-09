<script lang="ts">
	import { Button, type ButtonProps } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import type { Snippet } from 'svelte';
	import { appSettings } from '$lib/stores/settings';

	type Props = {
		open: boolean;
		action: string;
		itemName?: string;
		itemType: string;
		confirmText?: string;
		autoHideMs?: number;
		title?: string;
		position?: 'left' | 'right';
		unstyled?: boolean;
		disabled?: boolean;
		onConfirm: () => void;
		onOpenChange: (open: boolean) => void;
		children: Snippet<[{ open: boolean }]>;
	} & ButtonProps;

	let {
		open = $bindable(false),
		action,
		itemName = '',
		itemType,
		confirmText = 'Confirm',
		variant = 'destructive',
		autoHideMs = 3000,
		title = '',
		position = 'right',
		unstyled = false,
		onConfirm,
		onOpenChange,
		children
	}: Props = $props();

	// Get the confirmDestructive setting from the store
	const confirmDestructive = $derived($appSettings.confirmDestructive);

	// Truncate long names
	const displayName = $derived(itemName && itemName.length > 20 ? itemName.slice(0, 20) + '...' : itemName);

	// Auto-hide after specified time
	$effect(() => {
		if (open && autoHideMs > 0) {
			const timeout = setTimeout(() => {
				open = false;
				onOpenChange(false);
			}, autoHideMs);
			return () => clearTimeout(timeout);
		}
	});

	function handleConfirm() {
		onConfirm();
		open = false;
		onOpenChange(false);
	}

	function handleTriggerClick(e: MouseEvent) {
		e.stopPropagation();
		// If confirmDestructive is disabled, execute action immediately
		if (!confirmDestructive) {
			onConfirm();
			return;
		}
		open = !open;
		onOpenChange(open);
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		onOpenChange(newOpen);
	}
</script>

<Popover.Root bind:open onOpenChange={handleOpenChange}>
	<Popover.Trigger asChild>
		{#snippet child({ props })}
			<Button
				{title}
				{...props}
				onclick={handleTriggerClick}
			>
				{@render children({ open })}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		class="w-auto p-2 z-200"
		side="top"
		align={position === 'left' ? 'start' : 'end'}
		sideOffset={8}
	>
		<div class="flex items-center gap-2">
			<span class="text-xs whitespace-nowrap">{action} {itemType} {#if displayName}<strong>{displayName}</strong>{/if}?</span>
			<Button size="sm" {variant} class="h-6 px-2 text-xs" onclick={handleConfirm}>
				{confirmText}
			</Button>
		</div>
	</Popover.Content>
</Popover.Root>
