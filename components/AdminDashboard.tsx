import React, { useState, useEffect } from 'react';
import { DollarSign, Users, Clock, TrendingUp, AlertCircle, Crown, Mail } from 'lucide-react';
import { clientService } from '../services/clientService';
import { Client } from '../types';

const AdminDashboard: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    paidClients: 0,
    freeClients: 0,
    expiredClients: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'free' | 'expired'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const allClients = await clientService.getAllClients();
    const revenueStats = await clientService.getRevenueStats();

    setClients(allClients);
    setStats(revenueStats);
    setLoading(false);
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
