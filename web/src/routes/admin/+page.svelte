<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs'
  import { Avatar, AvatarFallback } from '$lib/components/ui/avatar'
</script>

<div class="mb-2 flex items-center justify-between space-y-2">
  <h1 class="text-2xl font-bold tracking-tight">Dashboard</h1>
</div>

<Tabs class="space-y-4" value="overview">
  <div class="w-full overflow-x-auto pb-2">
    <TabsList>
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="analytics">Analytics</TabsTrigger>
      <TabsTrigger value="reports" disabled>Reports</TabsTrigger>
      <TabsTrigger value="notifications" disabled>Notifications</TabsTrigger>
    </TabsList>
  </div>

  <TabsContent value="overview" class="space-y-4">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card><CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle class="text-sm font-medium">Total Revenue</CardTitle><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></CardHeader><CardContent><div class="text-2xl font-bold">$45,231.89</div><p class="text-xs text-muted-foreground">+20.1% from last month</p></CardContent></Card>
      <Card><CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle class="text-sm font-medium">Subscriptions</CardTitle><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></CardHeader><CardContent><div class="text-2xl font-bold">+2350</div><p class="text-xs text-muted-foreground">+180.1% from last month</p></CardContent></Card>
      <Card><CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle class="text-sm font-medium">Sales</CardTitle><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg></CardHeader><CardContent><div class="text-2xl font-bold">+12,234</div><p class="text-xs text-muted-foreground">+19% from last month</p></CardContent></Card>
      <Card><CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle class="text-sm font-medium">Active Now</CardTitle><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="h-4 w-4 text-muted-foreground"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></CardHeader><CardContent><div class="text-2xl font-bold">+573</div><p class="text-xs text-muted-foreground">+201 since last hour</p></CardContent></Card>
    </div>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-7">
      <Card class="col-span-1 lg:col-span-4"><CardHeader><CardTitle>Overview</CardTitle></CardHeader><CardContent class="ps-2"><div style="height:350px;display:flex;align-items:flex-end;gap:8px;padding:16px;">{#each ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as m}<div class="flex-1 flex flex-col items-center gap-1"><div class="w-full bg-primary rounded-t-md" style="height:{Math.floor(Math.random()*150)+50}px;border-radius:4px 4px 0 0;"></div><span class="text-xs text-muted-foreground">{m}</span></div>{/each}</div></CardContent></Card>
      <Card class="col-span-1 lg:col-span-3"><CardHeader><CardTitle>Recent Sales</CardTitle><CardDescription>You made 265 sales this month.</CardDescription></CardHeader><CardContent class="space-y-8">{#each [{n:'Olivia Martin',e:'olivia.martin@email.com',a:'+$1,999.00'},{n:'Jackson Lee',e:'jackson.lee@email.com',a:'+$39.00'},{n:'Isabella Nguyen',e:'isabella.nguyen@email.com',a:'+$299.00'},{n:'William Kim',e:'will@email.com',a:'+$99.00'},{n:'Sofia Davis',e:'sofia.davis@email.com',a:'+$39.00'}] as s}<div class="flex items-center gap-4"><Avatar class="h-9 w-9"><AvatarFallback>{s.n.split(' ').map(w=>w[0]).join('')}</AvatarFallback></Avatar><div class="flex flex-1 flex-wrap items-center justify-between"><div class="space-y-1"><p class="text-sm leading-none font-medium">{s.n}</p><p class="text-sm text-muted-foreground">{s.e}</p></div><div class="font-medium">{s.a}</div></div></div>{/each}</CardContent></Card>
    </div>
  </TabsContent>
</Tabs>

