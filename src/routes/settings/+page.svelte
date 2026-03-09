<svelte:head>
  <title>Settings - Dockhand</title>
</svelte:head>

<script lang="ts">
  import { Settings, Globe, Download, Layers, Bell, Crown, Users, Info, GitBranch } from '@lucide/svelte';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import * as Tabs from '$lib/components/ui/tabs';
  import PageHeader from '$lib/components/PageHeader.svelte';

  import GeneralTab from './general/GeneralTab.svelte';
  import EnvironmentsTab from './environments/EnvironmentsTab.svelte';
  import RegistriesTab from './registries/RegistriesTab.svelte';
  import GitTab from './git/GitTab.svelte';
  import ConfigSetsTab from './config-sets/ConfigSetsTab.svelte';
  import NotificationsTab from './notifications/NotificationsTab.svelte';
  import AuthTab from './auth/AuthTab.svelte';
  import LicenseTab from './license/LicenseTab.svelte';
  import AboutTab from './about/AboutTab.svelte';
  import { fetchEnvironments } from '$lib/utils/new';
  import { onMount } from 'svelte';
  import { Badge } from '$lib/components/ui/badge';

  // Tab state from URL
  let activeTab = $derived(page.url.searchParams.get('tab') ?? 'general');
  let editEnvId = $derived(page.url.searchParams.get('edit'));
  let newEnv = $derived(page.url.searchParams.get('new') === 'true');

  function handleTabChange(tab: string) {
    goto(`/settings?tab=${tab}`, { replaceState: true, noScroll: true });
  }

  let environments = $state<any[]>([]);

  onMount(async () => {
		environments = await fetchEnvironments();
	});
</script>

<div class="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
  <div class="shrink-0 flex flex-wrap justify-between items-center gap-3 min-h-8">
    <PageHeader icon={Settings} title="Settings" showConnection={false} />
  </div>

  <Tabs.Root value={activeTab} onValueChange={handleTabChange} class="w-full flex-1 min-h-0 flex flex-col">
    <Tabs.List class="w-full flex-wrap h-auto">
      <Tabs.Trigger value="general" class="flex-1">
        <Settings class="size-4" />
        General
      </Tabs.Trigger>

      <Tabs.Trigger value="environments" class="flex-1">
        <Globe class="size-4" />
        Environments
        {#if environments.length > 0}<Badge variant="secondary" class="text-xs">{environments.length} total</Badge>{/if}
      </Tabs.Trigger>

      <Tabs.Trigger value="registries" class="flex-1">
        <Download class="size-4" />
        Registries
      </Tabs.Trigger>

      <Tabs.Trigger value="git" class="flex-1">
        <GitBranch class="size-4" />
        Git
      </Tabs.Trigger>

      <Tabs.Trigger value="config-sets" class="flex-1">
        <Layers class="size-4" />
        Config sets
      </Tabs.Trigger>

      <Tabs.Trigger value="notifications" class="flex-1">
        <Bell class="size-4" />
        Notifications
      </Tabs.Trigger>

      <Tabs.Trigger value="auth" class="flex-1">
        <Users class="size-4" />
        Authentication
      </Tabs.Trigger>

      <Tabs.Trigger value="license" class="flex-1">
        <Crown class="size-4" />
        License
      </Tabs.Trigger>

      <Tabs.Trigger value="about" class="flex-1">
        <Info class="size-4" />
        About
      </Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="general" class="flex-1 min-h-0 overflow-y-auto">
      <GeneralTab />
    </Tabs.Content>

    <Tabs.Content value="environments" class="flex-1 min-h-0 overflow-y-auto">
      <EnvironmentsTab {editEnvId} {newEnv} />
    </Tabs.Content>

    <Tabs.Content value="registries" class="flex-1 min-h-0 overflow-y-auto">
      <RegistriesTab />
    </Tabs.Content>

    <Tabs.Content value="git" class="flex-1 min-h-0 overflow-y-auto">
      <GitTab />
    </Tabs.Content>

    <Tabs.Content value="config-sets" class="flex-1 min-h-0 overflow-y-auto">
      <ConfigSetsTab />
    </Tabs.Content>

    <Tabs.Content value="notifications" class="flex-1 min-h-0 overflow-y-auto">
      <NotificationsTab />
    </Tabs.Content>

    <Tabs.Content value="auth" class="flex-1 min-h-0 flex flex-col">
      <AuthTab />
    </Tabs.Content>

    <Tabs.Content value="license" class="flex-1 min-h-0 overflow-y-auto">
      <LicenseTab />
    </Tabs.Content>

    <Tabs.Content value="about" class="flex-1 min-h-0 overflow-y-auto">
      <AboutTab />
    </Tabs.Content>
  </Tabs.Root>
</div>
