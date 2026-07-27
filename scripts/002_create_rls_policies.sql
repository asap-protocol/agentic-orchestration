-- Enable Row Level Security on all tables
CREATE OR REPLACE FUNCTION public.get_user_workspace_roles()
RETURNS TABLE (
  workspace_id uuid,
  role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT workspace_id, role FROM public.workspace_members WHERE user_id = auth.uid();
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Workspaces policies
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON public.workspaces;
CREATE POLICY "Users can view workspaces they are members of"
  ON public.workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

DROP POLICY IF EXISTS "Workspace owners can update workspaces" ON public.workspaces;
CREATE POLICY "Workspace owners can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
CREATE POLICY "Users can create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Workspace owners can delete workspaces" ON public.workspaces;
CREATE POLICY "Workspace owners can delete workspaces"
  ON public.workspaces FOR DELETE
  USING (owner_id = auth.uid());

-- Workspace members policies
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON public.workspace_members;
CREATE POLICY "Users can view members of their workspaces"
  ON public.workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

DROP POLICY IF EXISTS "Workspace owners can manage members" ON public.workspace_members;
CREATE POLICY "Workspace owners can manage members"
  ON public.workspace_members FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role = 'owner'
    )
  );

-- Agents policies
DROP POLICY IF EXISTS "Users can view agents in their workspaces" ON public.agents;
CREATE POLICY "Users can view agents in their workspaces"
  ON public.agents FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

DROP POLICY IF EXISTS "Editors can create agents" ON public.agents;
CREATE POLICY "Editors can create agents"
  ON public.agents FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Editors can update agents" ON public.agents;
CREATE POLICY "Editors can update agents"
  ON public.agents FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Editors can delete agents" ON public.agents;
CREATE POLICY "Editors can delete agents"
  ON public.agents FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
  );

-- Tools policies (similar pattern)
DROP POLICY IF EXISTS "Users can view tools in their workspaces or global tools" ON public.tools;
CREATE POLICY "Users can view tools in their workspaces or global tools"
  ON public.tools FOR SELECT
  USING (
    is_global = true OR
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

DROP POLICY IF EXISTS "Editors can create tools" ON public.tools;
CREATE POLICY "Editors can create tools"
  ON public.tools FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
  );

-- Workflows policies (similar to agents)
DROP POLICY IF EXISTS "Users can view workflows in their workspaces" ON public.workflows;
CREATE POLICY "Users can view workflows in their workspaces"
  ON public.workflows FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

DROP POLICY IF EXISTS "Editors can create workflows" ON public.workflows;
CREATE POLICY "Editors can create workflows"
  ON public.workflows FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Editors can update workflows" ON public.workflows;
CREATE POLICY "Editors can update workflows"
  ON public.workflows FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Editors can delete workflows" ON public.workflows;
CREATE POLICY "Editors can delete workflows"
  ON public.workflows FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
  );

-- Workflow versions policies
DROP POLICY IF EXISTS "Users can view workflow versions in their workspaces" ON public.workflow_versions;
CREATE POLICY "Users can view workflow versions in their workspaces"
  ON public.workflow_versions FOR SELECT
  USING (
    workflow_id IN (
      SELECT id FROM public.workflows
      WHERE workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
    )
  );

DROP POLICY IF EXISTS "Editors can create workflow versions" ON public.workflow_versions;
CREATE POLICY "Editors can create workflow versions"
  ON public.workflow_versions FOR INSERT
  WITH CHECK (
    workflow_id IN (
      SELECT id FROM public.workflows
      WHERE workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
    )
  );

DROP POLICY IF EXISTS "Editors can update workflow versions" ON public.workflow_versions;
CREATE POLICY "Editors can update workflow versions"
  ON public.workflow_versions FOR UPDATE
  USING (
    workflow_id IN (
      SELECT id FROM public.workflows
      WHERE workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
    )
  );

DROP POLICY IF EXISTS "Editors can delete workflow versions" ON public.workflow_versions;
CREATE POLICY "Editors can delete workflow versions"
  ON public.workflow_versions FOR DELETE
  USING (
    workflow_id IN (
      SELECT id FROM public.workflows
      WHERE workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
    )
  );

-- Workflow executions policies
DROP POLICY IF EXISTS "Users can view executions in their workspaces" ON public.workflow_executions;
CREATE POLICY "Users can view executions in their workspaces"
  ON public.workflow_executions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

DROP POLICY IF EXISTS "Users can create executions" ON public.workflow_executions;
CREATE POLICY "Users can create executions"
  ON public.workflow_executions FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

DROP POLICY IF EXISTS "Users can update their executions" ON public.workflow_executions;
CREATE POLICY "Users can update their executions"
  ON public.workflow_executions FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

-- Runs policies
DROP POLICY IF EXISTS "Users can view runs in their workspaces" ON public.runs;
CREATE POLICY "Users can view runs in their workspaces"
  ON public.runs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

DROP POLICY IF EXISTS "Users can create runs" ON public.runs;
CREATE POLICY "Users can create runs"
  ON public.runs FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

DROP POLICY IF EXISTS "Users can update runs" ON public.runs;
CREATE POLICY "Users can update runs"
  ON public.runs FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

-- Connections policies
DROP POLICY IF EXISTS "Users can view connections in their workspaces" ON public.connections;
CREATE POLICY "Users can view connections in their workspaces"
  ON public.connections FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

DROP POLICY IF EXISTS "Editors can manage connections" ON public.connections;
CREATE POLICY "Editors can manage connections"
  ON public.connections FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
  );

-- MCP servers policies
DROP POLICY IF EXISTS "Users can view MCP servers in their workspaces" ON public.mcp_servers;
CREATE POLICY "Users can view MCP servers in their workspaces"
  ON public.mcp_servers FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
    )
  );

DROP POLICY IF EXISTS "Editors can manage MCP servers" ON public.mcp_servers;
CREATE POLICY "Editors can manage MCP servers"
  ON public.mcp_servers FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.get_user_workspace_roles()
      WHERE role IN ('owner', 'editor')
    )
  );
