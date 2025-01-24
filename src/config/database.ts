import { SupabaseDatabaseAdapter } from '@elizaos/adapter-supabase';
import { UUID, Memory, elizaLogger } from '@elizaos/core';
import { v4 as uuid } from 'uuid';

export class CustomSupabaseAdapter extends SupabaseDatabaseAdapter {
  async getRoom(roomId: UUID): Promise<UUID | null> {
    const { data, error } = await this.supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .maybeSingle();

    if (error) {
      elizaLogger.error(`Error getting room: ${error.message}`);
      return null;
    }
    return data ? (data.id as UUID) : null;
  }

  async getGoals(params: {
    roomId: UUID;
    count?: number;
    onlyInProgress?: boolean;
  }) {
    const { data: goals, error } = await this.supabase.rpc('get_goals', {
      only_in_progress: params.onlyInProgress ?? false,
      query_roomId: params.roomId,
      row_count: params.count ?? 10,
    });

    if (error) {
      elizaLogger.error('Error getting goals:', error);
      throw new Error(error.message);
    }

    return goals;
  }

  async createRoom(roomId?: UUID): Promise<UUID> {
    const id = roomId ?? (uuid() as UUID);
    const { data, error } = await this.supabase.rpc('create_room', {
      room_id: id,
    });

    if (error) {
      elizaLogger.error(`Error creating room: ${error.message}`);
      throw new Error(`Error creating room: ${error.message}`);
    }

    return data[0].id as UUID;
  }

  async addParticipant(userId: UUID, roomId: UUID): Promise<boolean> {
    const { error } = await this.supabase.from('participants').insert({
      id: uuid() as UUID,
      userId: userId,
      roomId: roomId,
    });

    if (error) {
      elizaLogger.error(`Error adding participant: ${error.message}`);
      return false;
    }
    return true;
  }

  async createMemory(
    memory: Memory,
    tableName: string,
    unique = false
  ): Promise<void> {
    elizaLogger.info('=== Memory Creation Started ===');
    elizaLogger.info('Connection Check', {
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL ? 'present' : 'missing',
        SUPABASE_KEY: process.env.SUPABASE_KEY ? 'present' : 'missing',
        URL_LENGTH: process.env.SUPABASE_URL?.length,
        KEY_LENGTH: process.env.SUPABASE_KEY?.length,
      },
    });

    // Check if we can list tables
    try {
      const { data: tableList, error: tableError } = await this.supabase
        .from('memories')
        .select('id')
        .limit(1);

      elizaLogger.info('Table access check', {
        success: !tableError,
        error: tableError?.message,
        hasAccess: !!tableList,
        table: 'memories',
      });
    } catch (e) {
      elizaLogger.error('Failed to check table access', {
        error: e instanceof Error ? e.message : String(e),
        table: 'memories',
      });
    }

    // Validate required fields
    if (!memory.id || !memory.userId || !memory.roomId || !memory.content) {
      const missingFields = [];
      if (!memory.id) missingFields.push('id');
      if (!memory.userId) missingFields.push('userId');
      if (!memory.roomId) missingFields.push('roomId');
      if (!memory.content) missingFields.push('content');

      elizaLogger.error('Memory validation failed - Missing fields', {
        memoryId: memory.id,
        missingFields,
        providedFields: Object.keys(memory),
      });
      throw new Error('Missing required memory fields');
    }

    // Validate content structure
    if (typeof memory.content !== 'object' || memory.content === null) {
      elizaLogger.error(
        'Memory validation failed - Invalid content structure',
        {
          memoryId: memory.id,
          contentType: typeof memory.content,
          isNull: memory.content === null,
          content: memory.content,
        }
      );
      throw new Error('Invalid memory content structure');
    }

    // Validate UUID formats
    const uuidPattern =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const uuidFields = {
      id: memory.id,
      userId: memory.userId,
      roomId: memory.roomId,
      agentId: memory.agentId,
    };

    for (const [field, value] of Object.entries(uuidFields)) {
      if (value && !uuidPattern.test(value)) {
        elizaLogger.warn('Memory validation - UUID format issue', {
          field,
          value,
          pattern: uuidPattern.source,
          length: value.length,
          matches: value.match(/-/g)?.length || 0,
        });

        const cleanedUuid = value.toLowerCase().replace(/[^0-9a-f-]/g, '');
        if (uuidPattern.test(cleanedUuid)) {
          elizaLogger.info('UUID cleaned and valid', {
            field,
            original: value,
            cleaned: cleanedUuid,
          });
          switch (field) {
            case 'id':
              memory.id = cleanedUuid as UUID;
              break;
            case 'userId':
              memory.userId = cleanedUuid as UUID;
              break;
            case 'roomId':
              memory.roomId = cleanedUuid as UUID;
              break;
            case 'agentId':
              memory.agentId = cleanedUuid as UUID;
              break;
          }
        } else {
          throw new Error(`Invalid UUID format for ${field}`);
        }
      }
    }

    // Validate embedding dimension if present
    if (memory.embedding) {
      try {
        elizaLogger.debug('Starting embedding validation and cleanup', {
          memoryId: memory.id,
          originalEmbedding: {
            length: memory.embedding.length,
            sample: memory.embedding.slice(0, 5),
            hasNulls: memory.embedding.some((n) => n === null),
            hasUndefined: memory.embedding.some((n) => n === undefined),
            hasNaN: memory.embedding.some(isNaN),
            allNaN: memory.embedding.every(isNaN),
            hasInfinity: memory.embedding.some((x) => !isFinite(x)),
          },
        });

        if (memory.embedding.every(isNaN)) {
          elizaLogger.error(
            'Memory validation failed - All embedding values are invalid',
            {
              memoryId: memory.id,
              sample: memory.embedding.slice(0, 5),
            }
          );
          throw new Error('Invalid embedding values');
        }

        memory.embedding = memory.embedding.map((n) => {
          if (!Number.isFinite(n) || n === null || n === undefined) {
            return 0;
          }
          return Number(n.toFixed(6));
        });

        const { data: dimensionData, error: dimensionError } =
          await this.supabase.rpc('get_embedding_dimension');

        if (dimensionError) {
          elizaLogger.error('Failed to get embedding dimension', {
            error: dimensionError.message,
            code: dimensionError.code,
          });
          throw new Error(
            `Error getting embedding dimension: ${dimensionError.message}`
          );
        }

        const expectedDimension = dimensionData as number;
        if (memory.embedding.length !== expectedDimension) {
          elizaLogger.error('Invalid embedding dimension', {
            expected: expectedDimension,
            actual: memory.embedding.length,
            memoryId: memory.id,
          });
          throw new Error(`expected ${expectedDimension} dimensions`);
        }
      } catch (error) {
        elizaLogger.error('Embedding validation failed', {
          error: error instanceof Error ? error.message : String(error),
          memoryId: memory.id,
        });
        throw error;
      }
    }

    try {
      const insertData = {
        id: memory.id,
        userId: memory.userId,
        agentId: memory.agentId,
        roomId: memory.roomId,
        content: JSON.stringify(memory.content),
        embedding: memory.embedding,
        type: tableName,
        createdAt: new Date(),
      };

      elizaLogger.debug('Database insert payload prepared', {
        memoryId: memory.id,
        payloadKeys: Object.keys(insertData),
        contentLength: insertData.content.length,
        hasEmbedding: !!insertData.embedding,
        contentSample: insertData.content.slice(0, 100),
        embeddingSample: memory.embedding ? memory.embedding.slice(0, 5) : null,
      });

      const { error } = await this.supabase.from('memories').insert(insertData);

      if (error) {
        elizaLogger.error('Memory creation failed', {
          error: error.message,
          code: error.code,
          details: error.details,
          memoryId: memory.id,
        });
        throw new Error(`Error creating memory: ${error.message}`);
      }

      elizaLogger.debug('Memory created successfully', {
        id: memory.id,
        table: tableName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      elizaLogger.error('Unexpected error during memory creation', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        memoryId: memory.id,
        context: 'database_insert',
      });
      throw error;
    }
  }

  async getMemories(params: {
    roomId?: UUID;
    userId?: UUID;
    agentId?: UUID;
    tableName: string;
    limit?: number;
    before?: number;
    after?: number;
  }): Promise<Memory[]> {
    elizaLogger.debug('Fetching memories', { params });

    try {
      let query = this.supabase
        .from('memories')
        .select('*')
        .eq('type', params.tableName);

      if (params.roomId) {
        query = query.eq('roomId', params.roomId);
      }
      if (params.userId) {
        query = query.eq('userId', params.userId);
      }
      if (params.agentId) {
        query = query.eq('agentId', params.agentId);
      }
      if (params.limit) {
        query = query.limit(params.limit);
      }
      if (params.before) {
        query = query.lt('createdAt', new Date(params.before).toISOString());
      }
      if (params.after) {
        query = query.gt('createdAt', new Date(params.after).toISOString());
      }

      const { data, error } = await query.order('createdAt', {
        ascending: true,
      });

      if (error) {
        elizaLogger.error('Error fetching memories', {
          error: error.message,
          code: error.code,
          details: error.details,
        });
        throw new Error(`Error retrieving memories: ${error.message}`);
      }

      return data.map((row) => ({
        id: row.id as UUID,
        userId: row.userId as UUID,
        agentId: row.agentId as UUID,
        roomId: row.roomId as UUID,
        content:
          typeof row.content === 'string'
            ? JSON.parse(row.content)
            : row.content,
        embedding: row.embedding ? Array.from(row.embedding) : undefined,
        createdAt: new Date(row.createdAt).getTime(),
      }));
    } catch (error) {
      elizaLogger.error('Unexpected error fetching memories', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export function initializeDatabase(supabaseUrl: string, supabaseKey: string) {
  return new CustomSupabaseAdapter(supabaseUrl, supabaseKey);
}
