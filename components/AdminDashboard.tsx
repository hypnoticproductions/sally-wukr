import React, { useState, useEffect } from 'react';
import { DollarSign, Users, Clock, TrendingUp, AlertCircle, Crown, Mail, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { clientService } from '../services/clientService';
import { Client } from '../types';
import { supabase } from '../services/supabaseClient';

const AdminDashboard: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    paidClients: 0,
    freeClients: 0,
    expiredClients: 0,
  });
  const [callStats, setCallStats] = useState({
    totalCalls: 0,
    inboundCalls: 0,
    outboundCalls: 0,
    averageDuration: 0,
  });
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'free' | 'expired'>('all');
  const [callingClient, setCallingClient] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const allClients = await clientService.getAllClients();
    const revenueStats = await clientService.getRevenueStats();

    setClients(allClients);
    setStats(revenueStats);

    await loadCallData();
    setLoading(false);
  };

  const loadCallData = async () => {
    const { data: calls } = await supabase
      .from('calls')
      .select('*, clients(name, email)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (calls) {
      setRecentCalls(calls);

      const totalCalls = calls.length;
      const inbound = calls.filter(c => c.direction === 'inbound').length;
      const outbound = calls.filter(c => c.direction === 'outbound').length;
      const avgDuration = calls.length > 0
        ? Math.floor(calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length)
        : 0;

      setCallStats({
        totalCalls,
        inboundCalls: inbound,
        outboundCalls: outbound,
        averageDuration: avgDuration,
      });
    }
  };

  const makeCall = async (clientId: string) => {
    setCallingClient(clientId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telnyx-call`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ client_id: clientId }),
        }
      );

      if (response.ok) {
        await loadCallData();
        alert('Call initiated successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to initiate call: ${error.error}`);
      }
    } catch (error) {
      alert('Error initiating call');
      console.error(error);
    } finally {
      setCallingClient(null);
    }
  };

  const getDaysRemaining = (expiresAt?: string): number | null => {
    if (!expiresAt) return null;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const filteredClients = clients.filter(client => {
    if (filter === 'all') return true;
    return client.payment_status === filter;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold gold-gradient mb-2">Sally Admin Dashboard</h1>
          <p className="text-gray-400">Client & Revenue Management</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="obsidian-card p-6 border border-gold-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-gold-500" />
              <div className="text-right">
                <p className="text-3xl font-bold gold-gradient">${stats.totalRevenue.toFixed(2)}</p>
                <p className="text-sm text-gray-400">Total Revenue</p>
              </div>
            </div>
          </div>

          <div className="obsidian-card p-6 border border-green-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <Crown className="w-8 h-8 text-green-500" />
              <div className="text-right">
                <p className="text-3xl font-bold text-green-400">{stats.paidClients}</p>
                <p className="text-sm text-gray-400">Paid Clients</p>
              </div>
            </div>
          </div>

          <div className="obsidian-card p-6 border border-blue-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-blue-500" />
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-400">{stats.freeClients}</p>
                <p className="text-sm text-gray-400">Free Clients</p>
              </div>
            </div>
          </div>

          <div className="obsidian-card p-6 border border-red-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div className="text-right">
                <p className="text-3xl font-bold text-red-400">{stats.expiredClients}</p>
                <p className="text-sm text-gray-400">Expired Profiles</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="obsidian-card p-6 border border-purple-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <Phone className="w-8 h-8 text-purple-500" />
              <div className="text-right">
                <p className="text-3xl font-bold text-purple-400">{callStats.totalCalls}</p>
                <p className="text-sm text-gray-400">Total Calls</p>
              </div>
            </div>
          </div>

          <div className="obsidian-card p-6 border border-cyan-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <PhoneIncoming className="w-8 h-8 text-cyan-500" />
              <div className="text-right">
                <p className="text-3xl font-bold text-cyan-400">{callStats.inboundCalls}</p>
                <p className="text-sm text-gray-400">Inbound Calls</p>
              </div>
            </div>
          </div>

          <div className="obsidian-card p-6 border border-orange-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <PhoneOutgoing className="w-8 h-8 text-orange-500" />
              <div className="text-right">
                <p className="text-3xl font-bold text-orange-400">{callStats.outboundCalls}</p>
                <p className="text-sm text-gray-400">Outbound Calls</p>
              </div>
            </div>
          </div>

          <div className="obsidian-card p-6 border border-teal-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-8 h-8 text-teal-500" />
              <div className="text-right">
                <p className="text-3xl font-bold text-teal-400">{callStats.averageDuration}s</p>
                <p className="text-sm text-gray-400">Avg Duration</p>
              </div>
            </div>
          </div>
        </div>

        <div className="obsidian-card border border-gold-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold gold-gradient">Client List</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filter === 'all'
                    ? 'bg-gold-500 text-black font-bold'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('paid')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filter === 'paid'
                    ? 'bg-green-500 text-black font-bold'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Paid
              </button>
              <button
                onClick={() => setFilter('free')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filter === 'free'
                    ? 'bg-blue-500 text-black font-bold'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Free
              </button>
              <button
                onClick={() => setFilter('expired')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filter === 'expired'
                    ? 'bg-red-500 text-black font-bold'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Expired
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-3 text-gray-400 font-semibold">Name</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Email</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Company</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Status</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Paid</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Score</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Expires</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const daysRemaining = getDaysRemaining(client.profile_expires_at);
                  return (
                    <tr key={client.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {client.payment_status === 'paid' && (
                            <Crown className="w-4 h-4 text-gold-500" />
                          )}
                          <span className="font-medium">{client.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <a href={`mailto:${client.email}`} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {client.email}
                        </a>
                      </td>
                      <td className="p-3 text-gray-300">{client.company || '-'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            client.payment_status === 'paid'
                              ? 'bg-green-500/20 text-green-400'
                              : client.payment_status === 'expired'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {client.payment_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-gold-400">${client.total_paid.toFixed(2)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gold-500"
                              style={{ width: `${client.client_value_score}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-400">{client.client_value_score}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {daysRemaining !== null ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span
                              className={`text-sm ${
                                daysRemaining < 5 ? 'text-red-400 font-semibold' : 'text-gray-400'
                              }`}
                            >
                              {daysRemaining}d
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {client.phone_number ? (
                          <button
                            onClick={() => makeCall(client.id)}
                            disabled={callingClient === client.id}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <PhoneCall className="w-4 h-4" />
                            {callingClient === client.id ? 'Calling...' : 'Call'}
                          </button>
                        ) : (
                          <span className="text-gray-600 text-sm">No phone</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredClients.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>No clients found in this category.</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 obsidian-card border border-gold-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold gold-gradient mb-6">Recent Calls</h2>
          <div className="space-y-3">
            {recentCalls.length > 0 ? (
              recentCalls.map((call) => (
                <div key={call.id} className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {call.direction === 'inbound' ? (
                        <PhoneIncoming className="w-5 h-5 text-cyan-400" />
                      ) : (
                        <PhoneOutgoing className="w-5 h-5 text-orange-400" />
                      )}
                      <div>
                        <p className="font-semibold text-white">
                          {call.clients?.name || call.from_number}
                        </p>
                        <p className="text-sm text-gray-400">
                          {call.to_number} • {new Date(call.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          call.call_state === 'answered'
                            ? 'bg-green-500/20 text-green-400'
                            : call.call_state === 'hangup'
                            ? 'bg-gray-500/20 text-gray-400'
                            : call.call_state === 'failed' || call.call_state === 'no_answer'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {call.call_state.toUpperCase()}
                      </span>
                      {call.duration_seconds > 0 && (
                        <p className="text-sm text-gray-400 mt-1">{call.duration_seconds}s</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Phone className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>No calls yet. Start calling clients!</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="obsidian-card border border-gold-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold gold-gradient mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Clients</span>
                <span className="font-bold text-white">{clients.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Conversion Rate</span>
                <span className="font-bold text-green-400">
                  {clients.length > 0
                    ? ((stats.paidClients / clients.length) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Avg. Revenue Per Client</span>
                <span className="font-bold text-gold-400">
                  ${clients.length > 0 ? (stats.totalRevenue / clients.length).toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Returning Clients</span>
                <span className="font-bold text-blue-400">
                  {clients.filter(c => c.returning_client).length}
                </span>
              </div>
            </div>
          </div>

          <div className="obsidian-card border border-gold-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold gold-gradient mb-4">Urgent Actions</h3>
            <div className="space-y-3">
              {clients
                .filter(c => {
                  const days = getDaysRemaining(c.profile_expires_at);
                  return days !== null && days <= 5 && days > 0;
                })
                .map(client => (
                  <div key={client.id} className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-orange-400">{client.name}</p>
                        <p className="text-xs text-gray-400">{client.email}</p>
                      </div>
                      <span className="text-xs bg-orange-500 text-black px-2 py-1 rounded font-bold">
                        {getDaysRemaining(client.profile_expires_at)}d left
                      </span>
                    </div>
                  </div>
                ))}
              {clients.filter(c => {
                const days = getDaysRemaining(c.profile_expires_at);
                return days !== null && days <= 5 && days > 0;
              }).length === 0 && (
                <p className="text-gray-500 text-center py-4">No urgent actions needed.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
