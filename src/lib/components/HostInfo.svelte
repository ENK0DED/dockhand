<script lang="ts">
	import { onMount } from 'svelte';
	import { Globe, ChevronDown, Check, HardDrive, Clock, Wifi, WifiOff, Route, UndoDot, Icon, Loader } from 'lucide-svelte';
	import { whale } from '@lucide/lab';
	import { currentEnvironment, environments, type Environment } from '$lib/stores/environment';
	import { sseConnected } from '$lib/stores/events';
	import { getIconComponent } from '$lib/utils/icons';
	import { toast } from 'svelte-sonner';
	import { formatTime } from '$lib/stores/settings';
	import { formatBytes } from '$lib/utils/new';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Button } from '$lib/components/ui/button';

	interface HostInfo {
		hostname: string;
		ipAddress: string;
		platform: string;
		arch: string;
		cpus: number;
		totalMemory: number;
		freeMemory: number;
		uptime: number;
		dockerVersion: string;
		dockerContainers: number;
		dockerContainersRunning: number;
		dockerImages: number;
		environment: Environment & { icon?: string; connectionType?: string; hawserVersion?: string };
	}

	interface DiskUsageInfo {
		LayersSize: number;
		Images: any[];
		Containers: any[];
		Volumes: any[];
		BuildCache: any[];
	}

	let hostInfo = $state<HostInfo | null>(null);
	let diskUsage = $state<DiskUsageInfo | null>(null);
	let diskUsageLoading = $state(false);
	let envAbortController: AbortController | null = null; // Aborts ALL requests when switching envs
	let currentEnvId = $state<number | null>(null);
	let lastUpdated = $state<Date>(new Date());
	let isConnected = $state(false);
	let initializedFromStore = false;
	let switchingEnvId = $state<number | null>(null); // Track which env is being switched to
	let offlineEnvIds = $state<Set<number>>(new Set()); // Track offline environments

	// Abort all pending requests for current environment
	function abortPendingRequests() {
		if (envAbortController) {
			envAbortController.abort();
			envAbortController = null;
		}
	}

	// Reactive environment list from store
	let envList = $derived($environments);

	sseConnected.subscribe(v => isConnected = v);

	// Subscribe to the store and react to changes (including from command palette)
	currentEnvironment.subscribe(env => {
		if (env) {
			// Only update if different to avoid loops and unnecessary fetches
			// Use Number() for type-safe comparison
			if (Number(env.id) !== Number(currentEnvId)) {
				currentEnvId = env.id;
				// Fetch new host info for the changed environment
				if (initializedFromStore) {
					fetchHostInfo();
					fetchDiskUsage();
				}
			}
			initializedFromStore = true;
		} else if (!env && envList.length > 0 && currentEnvId === null) {
			// Set current env to first if not restored from store
			currentEnvId = envList[0].id;
		}
	});

	// Watch for when current environment is deleted, all environments removed, or no env selected
	// IMPORTANT: Don't clear state when envList is empty during initial load - wait for environments to load first
	$effect(() => {
		// Skip if environments haven't loaded yet - the store subscription will handle initial setup
		if (envList.length === 0) return;

		if (currentEnvId === null) {
			// No environment selected - select first one
			currentEnvId = envList[0].id;
			fetchHostInfo();
			fetchDiskUsage();
		} else {
			// Use Number() for type-safe comparison in case of string/number mismatch
			const stillExists = envList.find((e: Environment) => Number(e.id) === Number(currentEnvId));
			if (!stillExists) {
				// Current environment was deleted - select first one
				currentEnvId = envList[0].id;
				fetchHostInfo();
				fetchDiskUsage();
			}
		}
	});

	async function fetchHostInfo() {
		// Skip if no environment selected or no abort controller
		if (!currentEnvId || !envAbortController) return;

		try {
			const url = `/api/host?env=${currentEnvId}`;
			const response = await fetch(url, { signal: envAbortController.signal });
			if (response.ok) {
				hostInfo = await response.json();
				lastUpdated = new Date();
				if (hostInfo?.environment) {
					currentEnvId = hostInfo.environment.id;
					// Update the store
					currentEnvironment.set({
						id: hostInfo.environment.id,
						name: hostInfo.environment.name,
						highlightChanges: hostInfo.environment.highlightChanges ?? true
					});
				}
			}
		} catch (error) {
			// Ignore abort errors
			if (error instanceof Error && error.name !== 'AbortError') {
				console.error('Failed to fetch host info:', error);
			}
		}
	}

	async function fetchDiskUsage() {
		// Skip if no environment selected or no abort controller
		if (!currentEnvId || !envAbortController) return;

		diskUsage = null;
		diskUsageLoading = true;

		try {
			const url = `/api/system/disk?env=${currentEnvId}`;
			const response = await fetch(url, { signal: envAbortController.signal });
			if (response.ok) {
				const data = await response.json();
				diskUsage = data.diskUsage;
			}
		} catch (error) {
			// Ignore abort errors
			if (error instanceof Error && error.name !== 'AbortError') {
				console.error('Failed to fetch disk usage:', error);
			}
			diskUsage = null;
		} finally {
			diskUsageLoading = false;
		}
	}

	// Calculate total disk usage
	let totalDiskUsage = $derived(() => {
		if (!diskUsage) return 0;
		return (diskUsage.LayersSize || 0) + (diskUsage.Volumes?.reduce((sum: number, v: any) => sum + (v.UsageData?.Size || 0), 0) || 0);
	});

	async function switchEnvironment(envId: number) {
		// Don't switch if already on this environment
		if (Number(envId) === Number(currentEnvId)) {
			return;
		}

		// Don't switch if already switching
		if (switchingEnvId !== null) {
			return;
		}

		// IMMEDIATELY abort all pending requests for current environment
		abortPendingRequests();

		// Clear stale data immediately for instant UI feedback
		diskUsage = null;
		diskUsageLoading = false;

		const targetEnv = envList.find((e: Environment) => Number(e.id) === Number(envId));
		const envName = targetEnv?.name || `Environment ${envId}`;

		// Mark as switching and create new abort controller
		switchingEnvId = envId;
		envAbortController = new AbortController();

		try {
			// Try to connect to the new environment first
			const url = `/api/host?env=${envId}`;
			const response = await fetch(url, { signal: envAbortController.signal });

			if (!response.ok) {
				offlineEnvIds.add(envId);
				offlineEnvIds = new Set(offlineEnvIds);
				toast.error(`Cannot switch to "${envName}" - environment is offline`);
				return;
			}

			const newHostInfo = await response.json();

			if (newHostInfo.error) {
				offlineEnvIds.add(envId);
				offlineEnvIds = new Set(offlineEnvIds);
				toast.error(`Cannot switch to "${envName}" - ${newHostInfo.error}`);
				return;
			}

			// Environment is online, proceed with switch
			offlineEnvIds.delete(envId);
			offlineEnvIds = new Set(offlineEnvIds);
			currentEnvId = envId;
			hostInfo = newHostInfo;
			lastUpdated = new Date();

			// Fetch disk usage (non-blocking, uses shared abort controller)
			fetchDiskUsage();

			// Update the store
			if (newHostInfo.environment) {
				currentEnvironment.set({
					id: newHostInfo.environment.id,
					name: newHostInfo.environment.name,
					highlightChanges: newHostInfo.environment.highlightChanges ?? true
				});
			}
		} catch (error) {
			// Ignore abort errors
			if (error instanceof Error && error.name === 'AbortError') {
				return;
			}
			offlineEnvIds.add(envId);
			offlineEnvIds = new Set(offlineEnvIds);
			toast.error(`Cannot switch to "${envName}" - connection failed`);
		} finally {
			switchingEnvId = null;
		}
	}

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86_400);
		const hours = Math.floor((seconds % 86_400) / 3600);
		return `${days > 0 ? `${days}d ` : ''}${hours}h`;
	}

	onMount(() => {
		// Create initial abort controller
		envAbortController = new AbortController();
		fetchHostInfo();
		fetchDiskUsage();
		return () => {
			abortPendingRequests(); // Abort on destroy
		};
	});

</script>

<div class="flex items-center min-w-0 text-xs text-muted-foreground divide-x space-x-3 *:pr-3">
	<!-- Environment Selector - always show -->
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline" size="sm" disabled={envList.length === 0}>
          {#if hostInfo?.environment && Number(hostInfo.environment.id) === Number(currentEnvId)}
            {@const EnvIcon = getIconComponent(hostInfo.environment.icon || 'globe')}
            <EnvIcon class="size-4 text-primary" />
            <span class="font-medium text-foreground">{hostInfo.environment.name}</span>
          {:else if currentEnvId && envList.length > 0}
            {@const currentEnv = envList.find(e => Number(e.id) === Number(currentEnvId))}

            {#if currentEnv}
              {@const EnvIcon = getIconComponent(currentEnv.icon || 'globe')}
              <EnvIcon class="size-4 text-primary" />
              <span class="font-medium text-foreground">{currentEnv.name}</span>
            {:else}
              <Globe class="size-4 text-muted-foreground" />
              <span class="font-medium text-foreground">Select environment</span>
            {/if}
          {:else}
            <Globe class="size-4 text-muted-foreground" />
            <span class="font-medium text-foreground">No environments</span>
          {/if}

          <ChevronDown class="size-3" />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Content align="start" class="w-36">
      <DropdownMenu.Group>
        <DropdownMenu.Label>Environment</DropdownMenu.Label>

        <DropdownMenu.Separator />

        <DropdownMenu.RadioGroup bind:value={currentEnvId}>
          {#each envList as env (env.id)}
            {@const EnvIcon = getIconComponent(env.icon || 'globe')}
            {@const isOffline = offlineEnvIds.has(env.id)}
            {@const isSwitching = switchingEnvId === env.id}
            <DropdownMenu.RadioItem value={env.id} disabled={isSwitching} onclick={() => switchEnvironment(env.id)}>
              {#if isSwitching}
                <Loader class="size-4 text-muted-foreground shrink-0 animate-spin" />
              {:else if isOffline}
                <WifiOff class="size-4 text-destructive shrink-0" />
              {:else}
                <EnvIcon class="size-4 text-muted-foreground shrink-0" />
              {/if}

              <span class="flex-1 whitespace-nowrap" class:text-muted-foreground={isOffline}>{env.name}</span>

              {#if isOffline && !isSwitching}
                <span class="text-xs text-destructive">offline</span>
              {/if}
            </DropdownMenu.RadioItem>
          {/each}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Group>
    </DropdownMenu.Content>
  </DropdownMenu.Root>

	{#if hostInfo}
		<!-- Platform/OS -->
		<div class="hidden md:block">{hostInfo.platform} {hostInfo.arch}</div>

		<!-- Docker version -->
		<div class="hidden md:block">Docker {hostInfo.dockerVersion}</div>

		<!-- Connection type -->
		<div class="hidden md:flex items-center gap-1">
			{#if hostInfo.environment?.connectionType === 'hawser-standard'}
				<Route class="size-3" />
				<span>Hawser (standard){hostInfo.environment.hawserVersion ? ` ${hostInfo.environment.hawserVersion}` : ''}</span>
			{:else if hostInfo.environment?.connectionType === 'hawser-edge'}
				<UndoDot class="size-3" />
				<span>Hawser (edge){hostInfo.environment.hawserVersion ? ` ${hostInfo.environment.hawserVersion}` : ''}</span>
			{:else}
				<Icon iconNode={whale} class="size-3" />
				<span>Socket</span>
			{/if}
		</div>

		<!-- CPU cores -->
		{#if hostInfo.cpus > 0}
			<div class="hidden lg:block">{hostInfo.cpus} cores</div>
		{/if}

		<!-- Memory -->
		{#if hostInfo.totalMemory > 0}
			<div class="hidden lg:block">{formatBytes(hostInfo.totalMemory)} RAM</div>
		{/if}

		<!-- Disk usage - only show when data is available (hide on timeout/error) -->
		{#if diskUsage && !diskUsageLoading}
			<div class="hidden xl:flex items-center gap-1">
				<HardDrive class="size-3" />
				<span>{formatBytes(totalDiskUsage())}</span>
			</div>
		{/if}

		<!-- Uptime - hidden for direct remote connections without Hawser -->
		{#if hostInfo.uptime > 0}
			<div class="hidden xl:flex items-center gap-1">
				<Clock class="size-3" />
				<span>{formatUptime(hostInfo.uptime)}</span>
			</div>
		{/if}

		<!-- Live indicator with timestamp -->
		<div
			class="flex items-center gap-1 {isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}"
			title={isConnected ? 'Live updates connected' : 'Live updates disconnected'}
		>
			<span class="text-muted-foreground mr-2">{formatTime(lastUpdated, { includeSeconds: true })}</span>
			{#if isConnected}
				<Wifi class="shrink-0 size-4" />
				<span class="font-medium">Live</span>
			{:else}
				<WifiOff class="shrink-0 size-4" />
			{/if}
		</div>
	{/if}
</div>
