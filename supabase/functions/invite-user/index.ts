import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the user from the JWT to check permissions
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Verify caller is an admin or owner
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || (roleData.role !== 'admin' && roleData.role !== 'owner')) {
      throw new Error('Unauthorized: Only admins and owners can invite users.');
    }

    // Get request body
    const { email, password, name, role, team_id, function_id, weight } = await req.json();

    if (!email || !name || !role) {
      throw new Error('Missing required fields: email, name, role');
    }

    console.log(`Inviting user: ${email} with role: ${role}`);

    // Map UI role to DB app_role
    let appRole = 'atendimento';
    if (role === 'admin' || role === 'manager') {
      appRole = 'admin';
    }

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password || 'Feimi2026!',
      email_confirm: true,
      user_metadata: { full_name: name }
    });

    if (authError) {
      console.error('Auth Error:', authError);
      throw authError;
    }

    const newUserId = authData.user.id;

    // 2. Add to user_roles
    const { error: insertRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: newUserId, role: appRole });

    if (insertRoleError) {
      console.error('Role Error:', insertRoleError);
      // Don't throw, maybe just log, as user is created
    }

    // 3. Update profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ user_id: newUserId, full_name: name });

    if (profileError) {
      console.error('Profile Error:', profileError);
    }

    // 4. Add to team_members
    const { data: teamMemberData, error: teamMemberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        name,
        email,
        role: role, // 'agent', 'manager', 'admin'
        status: 'active',
        team_id: team_id || null,
        function_id: function_id || null,
        weight: weight || 1
      })
      .select()
      .single();

    if (teamMemberError) {
      console.error('Team Member Error:', teamMemberError);
    }

    return new Response(
      JSON.stringify({ 
        message: 'User created successfully',
        user: authData.user,
        teamMember: teamMemberData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
