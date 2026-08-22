const { Setting, Shop } = require('../models');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/security');
const activityService = require('./activityService');

class TextLkService {
    constructor() {
        this.baseUrl = 'https://app.text.lk/api/v3';
    }

    /**
     * Get full config including credentials
     */
    async _getFullConfig(shopId) {
        if (!shopId) {
            // Global Super Admin settings
            const setting = await Setting.findOne({
                where: { shop_id: null, category: 'global' }
            });
            if (!setting || !setting.settings_data) return null;
            
            const config = { ...setting.settings_data };
            // For global settings, we assume textlk is enabled if API key exists or we can expect a boolean
            // Wait, we need to decrypt if we encrypted it, but for simplicity we rely on the raw value for now
            config.enabled = config.textlk_enabled === true || config.textlk_enabled === 'true';
            config.apiKey = config.textlk_api_key || config.apiKey;
            config.senderId = config.textlk_sender_id || config.senderId;
            if (config.apiKey && typeof config.apiKey === 'string' && config.apiKey.startsWith('enc:')) {
                config.apiKey = decrypt(config.apiKey);
            }
            return config;
        }

        const [setting, shop] = await Promise.all([
            Setting.findOne({
                where: {
                    shop_id: shopId,
                    category: 'textlk_crm'
                }
            }),
            Shop.findByPk(shopId, { attributes: ['textlk_enabled'] })
        ]);

        if (!setting) return null;

        let rawData = setting.settings_data;
        if (typeof rawData === 'string') {
            try {
                rawData = JSON.parse(rawData);
            } catch (e) {
                logger.error(`Text.lk: Failed to parse settings_data: ${e.message}`);
                return null;
            }
        }

        const config = { ...rawData };
        // Correctly pull enabled flag from Shop table
        config.enabled = shop?.textlk_enabled === true;
        if (config.apiKey && typeof config.apiKey === 'string' && config.apiKey.startsWith('enc:')) {
           config.apiKey = decrypt(config.apiKey);
        } else if (config.apiKey) {
           config.apiKey = decrypt(config.apiKey); // assuming legacy logic always encrypted
        }

        return config;
    }

    /**
     * Verify connection to Text.lk API
     */
    async verifyConnection(config) {
        try {
            const { apiKey } = config;
            if (!apiKey) throw new Error('API Key is required');

            // Using the GET contacts endpoint as a connectivity check
            const response = await fetch(`${this.baseUrl}/contacts?limit=1`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(10000)
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.status === 'error' || data.message === 'Unauthenticated.') {
                return {
                    success: false,
                    error: data.message || 'Unauthorized'
                };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Send SMS
     */
    async sendSms(shopId, payload) {
        try {
            const config = await this._getFullConfig(shopId);
            if (!config) {
                logger.error('[TextLk] sendSms: No config found for org ' + shopId);
                return null;
            }
            if (!config.enabled) {
                logger.error('[TextLk] sendSms: Text.lk is DISABLED in settings for org ' + shopId);
                return null;
            }

            // Auto-format phone number for Sri Lanka (e.g., 0771234567 -> 94771234567)
            let formattedRecipient = payload.recipient;
            if (formattedRecipient) {
                formattedRecipient = formattedRecipient.replace(/\D/g, ''); // Remove non-digits like spaces or dashes
                if (formattedRecipient.startsWith('0') && formattedRecipient.length === 10) {
                    formattedRecipient = '94' + formattedRecipient.substring(1);
                }
            }

            const requestBody = {
                recipient: formattedRecipient,
                sender_id: config.senderId || payload.sender_id,
                type: 'plain',
                message: payload.message,
            };

            logger.info(`[TextLk] sendSms: Sending to ${formattedRecipient} via sender "${requestBody.sender_id}"`);
            logger.info(`[TextLk] sendSms: API Key starts with: ${config.apiKey ? config.apiKey.substring(0, 8) + '...' : 'MISSING'}`);

            const response = await fetch(`${this.baseUrl}/sms/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(15000)
            });

            const data = await response.json();
            logger.info(`[TextLk] sendSms: HTTP ${response.status}, Response: ${JSON.stringify(data)}`);

            if (!response.ok || data.status === 'error') {
                throw new Error(data.message || 'Failed to send SMS');
            }
            
            await activityService.logSystemAction(shopId, null, 'SMS_SENT', 'SMS', null, {
                 recipient: formattedRecipient, 
                 sender: requestBody.sender_id,
                 content: payload.message 
            });

            return data;
        } catch (error) {
            logger.error(`[TextLk] sendSms ERROR: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get Contacts
     */
    async getContacts(shopId, page = 1, limit = 50) {
        try {
            const config = await this._getFullConfig(shopId);
            if (!config) throw new Error('Text.lk not configured');

            const response = await fetch(`${this.baseUrl}/contacts?page=${page}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to fetch contacts');

            return data;
        } catch (error) {
            logger.error(`Text.lk Get Contacts Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get Contact Groups
     */
    async getGroups(shopId) {
        try {
            const config = await this._getFullConfig(shopId);
            if (!config) throw new Error('Text.lk not configured');

            const response = await fetch(`${this.baseUrl}/contacts`, {
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to fetch groups');

            return data;
        } catch (error) {
            logger.error(`Text.lk Get Groups Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create a Contact Group
     */
    async createGroup(shopId, name) {
        try {
            const config = await this._getFullConfig(shopId);
            const response = await fetch(`${this.baseUrl}/contacts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ name }),
                signal: AbortSignal.timeout(10000)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to create group');
            return data;
        } catch (error) {
            logger.error(`Text.lk Create Group Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update a Contact Group
     */
    async updateGroup(shopId, uid, name) {
        try {
            const config = await this._getFullConfig(shopId);
            const response = await fetch(`${this.baseUrl}/contacts/${uid}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ name }),
                signal: AbortSignal.timeout(10000)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to update group');
            return data;
        } catch (error) {
            logger.error(`Text.lk Update Group Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete a Contact Group
     */
    async deleteGroup(shopId, uid) {
        try {
            const config = await this._getFullConfig(shopId);
            const response = await fetch(`${this.baseUrl}/contacts/${uid}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(10000)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to delete group');
            return data;
        } catch (error) {
            logger.error(`Text.lk Delete Group Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create/Sync a Contact
     */
    async createContact(shopId, contact) {
        try {
            const config = await this._getFullConfig(shopId);
            const response = await fetch(`${this.baseUrl}/contacts/initialize`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    first_name: contact.first_name,
                    last_name: contact.last_name,
                    phone: contact.phone,
                    group_id: contact.group_id
                }),
                signal: AbortSignal.timeout(10000)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to create contact');
            return data;
        } catch (error) {
            logger.error(`Text.lk Create Contact Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send Bulk Campaign
     */
    async sendCampaign(shopId, payload) {
        try {
            const config = await this._getFullConfig(shopId);
            if (!config || !config.enabled) throw new Error('Text.lk not configured or disabled');

            const response = await fetch(`${this.baseUrl}/sms/campaign`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    contact_list_id: payload.contact_list_id,
                    sender_id: config.senderId || payload.sender_id,
                    type: 'plain',
                    message: payload.message,
                    dlt_template_id: payload.dlt_template_id,
                    schedule_time: payload.schedule_time
                }),
                signal: AbortSignal.timeout(20000)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to send campaign');
            return data;
        } catch (error) {
            logger.error(`Text.lk Send Campaign Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get Balance
     */
    async getBalance(shopId) {
        try {
            const config = await this._getFullConfig(shopId);
            if (!config) throw new Error('Text.lk not configured');

            const response = await fetch(`${this.baseUrl}/balance`, {
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to fetch balance');

            return data;
        } catch (error) {
            logger.error(`Text.lk Get Balance Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get SMS Logs
     */
    async getSmsLogs(shopId, page = 1, limit = 100) {
        try {
            const config = await this._getFullConfig(shopId);
            if (!config) throw new Error('Text.lk not configured');

            const response = await fetch(`${this.baseUrl}/sms?page=${page}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to fetch SMS logs');

            return data;
        } catch (error) {
            logger.error(`Text.lk Get SMS Logs Error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new TextLkService();
