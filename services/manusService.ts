const MANUS_API_BASE = 'https://open.manus.ai/v1';

export interface ManusTask {
  project_id?: string;
  task: string;
  context?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
}

export interface ManusProject {
  name: string;
  description?: string;
  instructions?: string;
}

class ManusService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, method: string, body?: any) {
    const response = await fetch(`${MANUS_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Manus API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async createProject(project: ManusProject) {
    return this.makeRequest('/projects', 'POST', project);
  }

  async createTask(task: ManusTask) {
    return this.makeRequest('/tasks', 'POST', task);
  }

  async getTask(taskId: string) {
    return this.makeRequest(`/tasks/${taskId}`, 'GET');
  }

  async createClientTask(clientData: {
    name: string;
    email: string;
    company?: string;
    painPoints?: string;
    desiredOutcome?: string;
    paymentAmount: number;
    expiresAt: string;
    conversationScore?: number;
  }) {
    const taskDescription = `
## New Premium Client: ${clientData.name}

**Contact Information:**
- Name: ${clientData.name}
- Email: ${clientData.email}
${clientData.company ? `- Company: ${clientData.company}` : ''}

**Strategic Context:**
${clientData.painPoints ? `- Challenge: ${clientData.painPoints}` : ''}
${clientData.desiredOutcome ? `- Desired Outcome: ${clientData.desiredOutcome}` : ''}

**Account Details:**
- Payment Amount: $${clientData.paymentAmount}
- Profile Expires: ${new Date(clientData.expiresAt).toLocaleDateString()}
${clientData.conversationScore ? `- Conversation Quality Score: ${clientData.conversationScore}/100` : ''}

**Next Steps:**
1. Review client strategic context
2. Schedule initial consultation before ${new Date(new Date(clientData.expiresAt).getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
3. Prepare customized proposal based on pain points
4. Follow up 3 days before profile expiration

**Priority:** This is a paid client - high priority for Richard D. Fortune's consulting practice.
    `.trim();

    return this.createTask({
      task: taskDescription,
      context: {
        type: 'sally_paid_client',
        client_name: clientData.name,
        client_email: clientData.email,
        payment_amount: clientData.paymentAmount,
        expires_at: clientData.expiresAt,
        source: 'Sally Wukr AI Assistant',
      },
      priority: 'high',
    });
  }

  async createExpirationReminderTask(clientData: {
    name: string;
    email: string;
    expiresAt: string;
    originalTaskId?: string;
  }) {
    const taskDescription = `
## Profile Expiration Reminder: ${clientData.name}

**Client:** ${clientData.name} (${clientData.email})
**Expiration Date:** ${new Date(clientData.expiresAt).toLocaleDateString()}

**Action Required:**
- Contact client to discuss renewal
- Assess progress since initial payment
- Offer renewal or consulting engagement

${clientData.originalTaskId ? `**Related Task:** ${clientData.originalTaskId}` : ''}

**Urgency:** Profile expires in 3 days - immediate action required.
    `.trim();

    return this.createTask({
      task: taskDescription,
      context: {
        type: 'sally_expiration_reminder',
        client_name: clientData.name,
        client_email: clientData.email,
        expires_at: clientData.expiresAt,
        original_task_id: clientData.originalTaskId,
        source: 'Sally Wukr AI Assistant',
      },
      priority: 'high',
    });
  }
}

export const createManusService = (apiKey: string) => {
  return new ManusService(apiKey);
};
