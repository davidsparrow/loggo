/**
 * MCP server + external connector types.
 */

/** MCP server status */
export type ServerStatus = 'running' | 'stopped' | 'error' | 'starting';

/** MCP server entry */
export interface McpServer {
  id: string;
  name: string;
  status: ServerStatus;
  uptime?: number;
  logs: string[];
}

/** External connector type */
export type ConnectorType = 'gmail' | 'slack' | 'google-sheets' | 'custom';

/** Connector status */
export type ConnectorStatus = 'connected' | 'disconnected' | 'error';

/** External connector entry */
export interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  enabled: boolean;
  /** Whether credentials are stored */
  hasCredentials: boolean;
}

