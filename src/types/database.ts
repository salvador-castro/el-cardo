export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      actividades: {
        Row: {
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["estado_actividad"]
          fin: string | null
          id: string
          inicio: string
          nombre: string
          notas: string | null
          precio: number
          profesor_id: string | null
          tipo: Database["public"]["Enums"]["tipo_actividad"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["estado_actividad"]
          fin?: string | null
          id?: string
          inicio: string
          nombre: string
          notas?: string | null
          precio?: number
          profesor_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_actividad"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["estado_actividad"]
          fin?: string | null
          id?: string
          inicio?: string
          nombre?: string
          notas?: string | null
          precio?: number
          profesor_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_actividad"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actividades_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "jugadores_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cobro_eventos: {
        Row: {
          cobro_id: string
          created_at: string
          detalle: string | null
          id: number
          link_id: string | null
          tipo: Database["public"]["Enums"]["tipo_evento_cobro"]
          usuario_id: string | null
        }
        Insert: {
          cobro_id: string
          created_at?: string
          detalle?: string | null
          id?: never
          link_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_evento_cobro"]
          usuario_id?: string | null
        }
        Update: {
          cobro_id?: string
          created_at?: string
          detalle?: string | null
          id?: never
          link_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_evento_cobro"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobro_eventos_cobro_id_fkey"
            columns: ["cobro_id"]
            isOneToOne: false
            referencedRelation: "cobros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobro_eventos_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobro_eventos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cobros: {
        Row: {
          actividad_id: string | null
          comprobante_path: string | null
          concepto: Database["public"]["Enums"]["concepto_cobro"]
          created_at: string
          created_by: string | null
          descripcion: string
          estado: Database["public"]["Enums"]["estado_cobro"]
          id: string
          jugador_id: string
          medio_pago: Database["public"]["Enums"]["medio_pago"] | null
          monto: number
          monto_pagado: number
          mp_payment_id: string | null
          nota: string | null
          pagado_at: string | null
          participacion_id: string | null
          periodo: string | null
          updated_at: string
          updated_by: string | null
          vencimiento: string
        }
        Insert: {
          actividad_id?: string | null
          comprobante_path?: string | null
          concepto: Database["public"]["Enums"]["concepto_cobro"]
          created_at?: string
          created_by?: string | null
          descripcion: string
          estado?: Database["public"]["Enums"]["estado_cobro"]
          id?: string
          jugador_id: string
          medio_pago?: Database["public"]["Enums"]["medio_pago"] | null
          monto: number
          monto_pagado?: number
          mp_payment_id?: string | null
          nota?: string | null
          pagado_at?: string | null
          participacion_id?: string | null
          periodo?: string | null
          updated_at?: string
          updated_by?: string | null
          vencimiento: string
        }
        Update: {
          actividad_id?: string | null
          comprobante_path?: string | null
          concepto?: Database["public"]["Enums"]["concepto_cobro"]
          created_at?: string
          created_by?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_cobro"]
          id?: string
          jugador_id?: string
          medio_pago?: Database["public"]["Enums"]["medio_pago"] | null
          monto?: number
          monto_pagado?: number
          mp_payment_id?: string | null
          nota?: string | null
          pagado_at?: string | null
          participacion_id?: string | null
          periodo?: string | null
          updated_at?: string
          updated_by?: string | null
          vencimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobros_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_participacion_id_fkey"
            columns: ["participacion_id"]
            isOneToOne: false
            referencedRelation: "participaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          cuota_social_dia_vencimiento: number
          cuota_social_monto: number
          dias_validez_link: number
          dias_vencimiento_actividad: number
          id: boolean
          precio_clase: number
          precio_practica: number
          precio_torneo: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cuota_social_dia_vencimiento?: number
          cuota_social_monto: number
          dias_validez_link?: number
          dias_vencimiento_actividad?: number
          id?: boolean
          precio_clase?: number
          precio_practica?: number
          precio_torneo?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cuota_social_dia_vencimiento?: number
          cuota_social_monto?: number
          dias_validez_link?: number
          dias_vencimiento_actividad?: number
          id?: boolean
          precio_clase?: number
          precio_practica?: number
          precio_torneo?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cuota_social_historial: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          monto: number
          vigente_desde: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          monto: number
          vigente_desde: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          monto?: number
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuota_social_historial_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipos: {
        Row: {
          actividad_id: string
          categoria_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          nombre: string
          zona_id: string | null
        }
        Insert: {
          actividad_id: string
          categoria_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nombre: string
          zona_id?: string | null
        }
        Update: {
          actividad_id?: string
          categoria_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nombre?: string
          zona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipos_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipos_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipos_categoria_id_actividad_id_fkey"
            columns: ["categoria_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "torneo_categorias"
            referencedColumns: ["id", "actividad_id"]
          },
          {
            foreignKeyName: "equipos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipos_zona_id_categoria_id_fkey"
            columns: ["zona_id", "categoria_id"]
            isOneToOne: false
            referencedRelation: "torneo_zonas"
            referencedColumns: ["id", "categoria_id"]
          },
        ]
      }
      goleadores: {
        Row: {
          cantidad: number
          id: string
          jugador_id: string
          partido_id: string
        }
        Insert: {
          cantidad: number
          id?: string
          jugador_id: string
          partido_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          jugador_id?: string
          partido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goleadores_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goleadores_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goleadores_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "partidos"
            referencedColumns: ["id"]
          },
        ]
      }
      handicap_historial: {
        Row: {
          created_at: string
          created_by: string | null
          handicap_anterior: number | null
          handicap_nuevo: number
          id: string
          jugador_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          handicap_anterior?: number | null
          handicap_nuevo: number
          id?: string
          jugador_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          handicap_anterior?: number | null
          handicap_nuevo?: number
          id?: string
          jugador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handicap_historial_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handicap_historial_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handicap_historial_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores_resumen"
            referencedColumns: ["id"]
          },
        ]
      }
      jugador_documentos: {
        Row: {
          archivo_nombre: string | null
          archivo_path: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          jugador_id: string
          tipo: Database["public"]["Enums"]["tipo_documento"]
          vencimiento: string | null
        }
        Insert: {
          archivo_nombre?: string | null
          archivo_path?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          jugador_id: string
          tipo: Database["public"]["Enums"]["tipo_documento"]
          vencimiento?: string | null
        }
        Update: {
          archivo_nombre?: string | null
          archivo_path?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          jugador_id?: string
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          vencimiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jugador_documentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jugador_documentos_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jugador_documentos_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores_resumen"
            referencedColumns: ["id"]
          },
        ]
      }
      jugadores: {
        Row: {
          activo: boolean
          apellido: string
          busqueda: string | null
          club_origen: string | null
          created_at: string
          created_by: string | null
          direccion: string | null
          dni: string | null
          email: string | null
          emergencia_nombre: string | null
          emergencia_telefono: string | null
          emergencia_vinculo: string | null
          es_profesor: boolean
          fecha_alta: string
          fecha_nacimiento: string | null
          foto_path: string | null
          grupo_sanguineo: string | null
          handicap: number
          id: string
          mano: Database["public"]["Enums"]["mano"] | null
          nombre: string
          notas: string | null
          numero_afiliado: string | null
          obra_social: string | null
          telefono: string | null
          tipo: Database["public"]["Enums"]["tipo_jugador"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          apellido: string
          busqueda?: string | null
          club_origen?: string | null
          created_at?: string
          created_by?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          emergencia_nombre?: string | null
          emergencia_telefono?: string | null
          emergencia_vinculo?: string | null
          es_profesor?: boolean
          fecha_alta?: string
          fecha_nacimiento?: string | null
          foto_path?: string | null
          grupo_sanguineo?: string | null
          handicap?: number
          id?: string
          mano?: Database["public"]["Enums"]["mano"] | null
          nombre: string
          notas?: string | null
          numero_afiliado?: string | null
          obra_social?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_jugador"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          apellido?: string
          busqueda?: string | null
          club_origen?: string | null
          created_at?: string
          created_by?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          emergencia_nombre?: string | null
          emergencia_telefono?: string | null
          emergencia_vinculo?: string | null
          es_profesor?: boolean
          fecha_alta?: string
          fecha_nacimiento?: string | null
          foto_path?: string | null
          grupo_sanguineo?: string | null
          handicap?: number
          id?: string
          mano?: Database["public"]["Enums"]["mano"] | null
          nombre?: string
          notas?: string | null
          numero_afiliado?: string | null
          obra_social?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_jugador"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jugadores_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jugadores_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      link_pago_cobros: {
        Row: {
          cobro_id: string
          link_id: string
          monto: number
        }
        Insert: {
          cobro_id: string
          link_id: string
          monto: number
        }
        Update: {
          cobro_id?: string
          link_id?: string
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "link_pago_cobros_cobro_id_fkey"
            columns: ["cobro_id"]
            isOneToOne: false
            referencedRelation: "cobros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_pago_cobros_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      links_pago: {
        Row: {
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["estado_link"]
          expira_at: string
          id: string
          jugador_id: string
          monto_total: number
          mp_init_point: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          pagado_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["estado_link"]
          expira_at: string
          id?: string
          jugador_id: string
          monto_total: number
          mp_init_point?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          pagado_at?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["estado_link"]
          expira_at?: string
          id?: string
          jugador_id?: string
          monto_total?: number
          mp_init_point?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          pagado_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_pago_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_pago_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_pago_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores_resumen"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_mp: {
        Row: {
          created_at: string
          link_id: string | null
          monto: number | null
          mp_payment_id: string
          payload: Json | null
          resultado: string
          status: string
        }
        Insert: {
          created_at?: string
          link_id?: string | null
          monto?: number | null
          mp_payment_id: string
          payload?: Json | null
          resultado: string
          status: string
        }
        Update: {
          created_at?: string
          link_id?: string | null
          monto?: number | null
          mp_payment_id?: string
          payload?: Json | null
          resultado?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_mp_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      devoluciones: {
        Row: {
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          jugador_id: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          nota: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          jugador_id: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          nota?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          jugador_id?: string
          medio?: Database["public"]["Enums"]["medio_pago"]
          monto?: number
          nota?: string | null
        }
        Relationships: []
      }
      pago_aplicaciones: {
        Row: {
          cobro_id: string
          created_at: string
          monto: number
          pago_id: string
        }
        Insert: {
          cobro_id: string
          created_at?: string
          monto: number
          pago_id: string
        }
        Update: {
          cobro_id?: string
          created_at?: string
          monto?: number
          pago_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pago_aplicaciones_cobro_id_fkey"
            columns: ["cobro_id"]
            isOneToOne: false
            referencedRelation: "cobros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_aplicaciones_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          anulado: boolean
          anulado_at: string | null
          anulado_motivo: string | null
          comprobante_path: string | null
          created_at: string
          created_by: string | null
          id: string
          jugador_id: string
          link_id: string | null
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          mp_payment_id: string | null
          nota: string | null
          pagado_at: string
        }
        Insert: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          comprobante_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jugador_id: string
          link_id?: string | null
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          mp_payment_id?: string | null
          nota?: string | null
          pagado_at?: string
        }
        Update: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          comprobante_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jugador_id?: string
          link_id?: string | null
          medio?: Database["public"]["Enums"]["medio_pago"]
          monto?: number
          mp_payment_id?: string | null
          nota?: string | null
          pagado_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
        ]
      }
      participaciones: {
        Row: {
          actividad_id: string
          asistencia: Database["public"]["Enums"]["asistencia"] | null
          bonificado: boolean
          created_at: string
          created_by: string | null
          equipo_id: string | null
          id: string
          jugador_id: string
          precio: number | null
        }
        Insert: {
          actividad_id: string
          asistencia?: Database["public"]["Enums"]["asistencia"] | null
          bonificado?: boolean
          created_at?: string
          created_by?: string | null
          equipo_id?: string | null
          id?: string
          jugador_id: string
          precio?: number | null
        }
        Update: {
          actividad_id?: string
          asistencia?: Database["public"]["Enums"]["asistencia"] | null
          bonificado?: boolean
          created_at?: string
          created_by?: string | null
          equipo_id?: string | null
          id?: string
          jugador_id?: string
          precio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participaciones_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participaciones_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participaciones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participaciones_equipo_id_actividad_id_fkey"
            columns: ["equipo_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "equipos"
            referencedColumns: ["id", "actividad_id"]
          },
          {
            foreignKeyName: "participaciones_equipo_id_actividad_id_fkey"
            columns: ["equipo_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "equipos_resumen"
            referencedColumns: ["id", "actividad_id"]
          },
          {
            foreignKeyName: "participaciones_equipo_id_actividad_id_fkey"
            columns: ["equipo_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "posiciones"
            referencedColumns: ["equipo_id", "actividad_id"]
          },
          {
            foreignKeyName: "participaciones_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participaciones_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores_resumen"
            referencedColumns: ["id"]
          },
        ]
      }
      partido_descansos: {
        Row: {
          chukker: number
          jugador_id: string
          partido_id: string
        }
        Insert: {
          chukker: number
          jugador_id: string
          partido_id: string
        }
        Update: {
          chukker?: number
          jugador_id?: string
          partido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partido_descansos_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partido_descansos_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partido_descansos_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "partidos"
            referencedColumns: ["id"]
          },
        ]
      }
      partidos: {
        Row: {
          actividad_id: string
          cancha: string | null
          categoria_id: string | null
          chukkers: number
          color_a: string | null
          color_b: string | null
          created_at: string
          desde_a_partido: string | null
          desde_a_puesto: number | null
          desde_a_resultado: string | null
          desde_a_zona: string | null
          desde_b_partido: string | null
          desde_b_puesto: number | null
          desde_b_resultado: string | null
          desde_b_zona: string | null
          equipo_a_id: string | null
          equipo_b_id: string | null
          estado: Database["public"]["Enums"]["estado_partido"]
          fase: Database["public"]["Enums"]["fase_partido"]
          goles_a: number | null
          goles_b: number | null
          goles_chukkers: Json | null
          id: string
          inicio: string | null
          notas: string | null
          orden: number
          placeholder_a: string | null
          placeholder_b: string | null
          updated_at: string
          updated_by: string | null
          zona_id: string | null
        }
        Insert: {
          actividad_id: string
          cancha?: string | null
          categoria_id?: string | null
          chukkers?: number
          color_a?: string | null
          color_b?: string | null
          created_at?: string
          desde_a_partido?: string | null
          desde_a_puesto?: number | null
          desde_a_resultado?: string | null
          desde_a_zona?: string | null
          desde_b_partido?: string | null
          desde_b_puesto?: number | null
          desde_b_resultado?: string | null
          desde_b_zona?: string | null
          equipo_a_id?: string | null
          equipo_b_id?: string | null
          estado?: Database["public"]["Enums"]["estado_partido"]
          fase?: Database["public"]["Enums"]["fase_partido"]
          goles_a?: number | null
          goles_b?: number | null
          goles_chukkers?: Json | null
          id?: string
          inicio?: string | null
          notas?: string | null
          orden?: number
          placeholder_a?: string | null
          placeholder_b?: string | null
          updated_at?: string
          updated_by?: string | null
          zona_id?: string | null
        }
        Update: {
          actividad_id?: string
          cancha?: string | null
          categoria_id?: string | null
          chukkers?: number
          color_a?: string | null
          color_b?: string | null
          created_at?: string
          desde_a_partido?: string | null
          desde_a_puesto?: number | null
          desde_a_resultado?: string | null
          desde_a_zona?: string | null
          desde_b_partido?: string | null
          desde_b_puesto?: number | null
          desde_b_resultado?: string | null
          desde_b_zona?: string | null
          equipo_a_id?: string | null
          equipo_b_id?: string | null
          estado?: Database["public"]["Enums"]["estado_partido"]
          fase?: Database["public"]["Enums"]["fase_partido"]
          goles_a?: number | null
          goles_b?: number | null
          goles_chukkers?: Json | null
          id?: string
          inicio?: string | null
          notas?: string | null
          orden?: number
          placeholder_a?: string | null
          placeholder_b?: string | null
          updated_at?: string
          updated_by?: string | null
          zona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partidos_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_categoria_id_actividad_id_fkey"
            columns: ["categoria_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "torneo_categorias"
            referencedColumns: ["id", "actividad_id"]
          },
          {
            foreignKeyName: "partidos_desde_a_partido_fkey"
            columns: ["desde_a_partido"]
            isOneToOne: false
            referencedRelation: "partidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_desde_a_zona_fkey"
            columns: ["desde_a_zona"]
            isOneToOne: false
            referencedRelation: "torneo_zonas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_desde_b_partido_fkey"
            columns: ["desde_b_partido"]
            isOneToOne: false
            referencedRelation: "partidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_desde_b_zona_fkey"
            columns: ["desde_b_zona"]
            isOneToOne: false
            referencedRelation: "torneo_zonas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_equipo_a_id_actividad_id_fkey"
            columns: ["equipo_a_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "equipos"
            referencedColumns: ["id", "actividad_id"]
          },
          {
            foreignKeyName: "partidos_equipo_a_id_actividad_id_fkey"
            columns: ["equipo_a_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "equipos_resumen"
            referencedColumns: ["id", "actividad_id"]
          },
          {
            foreignKeyName: "partidos_equipo_a_id_actividad_id_fkey"
            columns: ["equipo_a_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "posiciones"
            referencedColumns: ["equipo_id", "actividad_id"]
          },
          {
            foreignKeyName: "partidos_equipo_b_id_actividad_id_fkey"
            columns: ["equipo_b_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "equipos"
            referencedColumns: ["id", "actividad_id"]
          },
          {
            foreignKeyName: "partidos_equipo_b_id_actividad_id_fkey"
            columns: ["equipo_b_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "equipos_resumen"
            referencedColumns: ["id", "actividad_id"]
          },
          {
            foreignKeyName: "partidos_equipo_b_id_actividad_id_fkey"
            columns: ["equipo_b_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "posiciones"
            referencedColumns: ["equipo_id", "actividad_id"]
          },
          {
            foreignKeyName: "partidos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_zona_id_categoria_id_fkey"
            columns: ["zona_id", "categoria_id"]
            isOneToOne: false
            referencedRelation: "torneo_zonas"
            referencedColumns: ["id", "categoria_id"]
          },
        ]
      }
      perfiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nombre: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      torneo_categorias: {
        Row: {
          actividad_id: string
          created_at: string
          formato: string
          id: string
          nombre: string
          orden: number
          puntos_derrota: number
          puntos_empate: number
          puntos_victoria: number
          tope_handicap: number | null
        }
        Insert: {
          actividad_id: string
          created_at?: string
          formato?: string
          id?: string
          nombre: string
          orden?: number
          puntos_derrota?: number
          puntos_empate?: number
          puntos_victoria?: number
          tope_handicap?: number | null
        }
        Update: {
          actividad_id?: string
          created_at?: string
          formato?: string
          id?: string
          nombre?: string
          orden?: number
          puntos_derrota?: number
          puntos_empate?: number
          puntos_victoria?: number
          tope_handicap?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "torneo_categorias_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "torneo_categorias_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades_resumen"
            referencedColumns: ["id"]
          },
        ]
      }
      torneo_zonas: {
        Row: {
          categoria_id: string
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          categoria_id: string
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          categoria_id?: string
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "torneo_zonas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "torneo_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      actividades_resumen: {
        Row: {
          created_at: string | null
          created_by: string | null
          estado: Database["public"]["Enums"]["estado_actividad"] | null
          fin: string | null
          id: string | null
          inicio: string | null
          monto_cobrado: number | null
          monto_esperado: number | null
          nombre: string | null
          notas: string | null
          participantes: number | null
          precio: number | null
          presentes: number | null
          profesor_id: string | null
          profesor_nombre: string | null
          tipo: Database["public"]["Enums"]["tipo_actividad"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actividades_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "jugadores_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipos_resumen: {
        Row: {
          actividad_id: string | null
          cantidad_jugadores: number | null
          categoria_id: string | null
          categoria_nombre: string | null
          created_at: string | null
          created_by: string | null
          excede_tope: boolean | null
          handicap_total: number | null
          id: string | null
          nombre: string | null
          tope_handicap: number | null
          zona_id: string | null
          zona_nombre: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipos_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipos_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipos_categoria_id_actividad_id_fkey"
            columns: ["categoria_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "torneo_categorias"
            referencedColumns: ["id", "actividad_id"]
          },
          {
            foreignKeyName: "equipos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipos_zona_id_categoria_id_fkey"
            columns: ["zona_id", "categoria_id"]
            isOneToOne: false
            referencedRelation: "torneo_zonas"
            referencedColumns: ["id", "categoria_id"]
          },
        ]
      }
      goleadores_torneo: {
        Row: {
          actividad_id: string | null
          categoria_id: string | null
          goles: number | null
          jugador: string | null
          jugador_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goleadores_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goleadores_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_categoria_id_actividad_id_fkey"
            columns: ["categoria_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "torneo_categorias"
            referencedColumns: ["id", "actividad_id"]
          },
        ]
      }
      jugadores_resumen: {
        Row: {
          activo: boolean | null
          alerta_documentos: string | null
          apellido: string | null
          apto_estado: string | null
          apto_vencimiento: string | null
          busqueda: string | null
          club_origen: string | null
          cobros_adeudados: number | null
          created_at: string | null
          created_by: string | null
          deuda: number | null
          direccion: string | null
          dni: string | null
          email: string | null
          emergencia_nombre: string | null
          emergencia_telefono: string | null
          emergencia_vinculo: string | null
          es_profesor: boolean | null
          fecha_alta: string | null
          fecha_nacimiento: string | null
          foto_path: string | null
          grupo_sanguineo: string | null
          handicap: number | null
          id: string | null
          mano: Database["public"]["Enums"]["mano"] | null
          nombre: string | null
          notas: string | null
          numero_afiliado: string | null
          obra_social: string | null
          telefono: string | null
          saldo_a_favor: number | null
          tipo: Database["public"]["Enums"]["tipo_jugador"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jugadores_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jugadores_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posiciones: {
        Row: {
          actividad_id: string | null
          categoria_id: string | null
          dif: number | null
          equipo: string | null
          equipo_id: string | null
          gc: number | null
          gf: number | null
          pe: number | null
          pg: number | null
          pj: number | null
          posicion: number | null
          pp: number | null
          pts: number | null
          zona_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipos_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipos_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipos_categoria_id_actividad_id_fkey"
            columns: ["categoria_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "torneo_categorias"
            referencedColumns: ["id", "actividad_id"]
          },
          {
            foreignKeyName: "equipos_zona_id_categoria_id_fkey"
            columns: ["zona_id", "categoria_id"]
            isOneToOne: false
            referencedRelation: "torneo_zonas"
            referencedColumns: ["id", "categoria_id"]
          },
        ]
      }
    }
    Functions: {
      agregar_participantes: {
        Args: {
          p_actividad_id: string
          p_equipo_id?: string
          p_jugadores: string[]
        }
        Returns: number
      }
      buscar_jugadores: {
        Args: { p_limite?: number; p_solo_activos?: boolean; p_texto: string }
        Returns: {
          activo: boolean
          apellido: string
          club_origen: string
          dni: string
          es_profesor: boolean
          handicap: number
          id: string
          nombre: string
          similitud: number
          tipo: Database["public"]["Enums"]["tipo_jugador"]
        }[]
      }
      buscar_jugadores_lista: {
        Args: { p_por_texto?: number; p_textos: string[] }
        Returns: {
          apellido: string
          club_origen: string
          handicap: number
          id: string
          indice: number
          nombre: string
          similitud: number
          texto: string
          tipo: Database["public"]["Enums"]["tipo_jugador"]
        }[]
      }
      crear_cobro_participacion: {
        Args: { p_participacion_id: string }
        Returns: boolean
      }
      crear_link_pago: {
        Args: { p_cobro_ids: string[]; p_monto?: number }
        Returns: {
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["estado_link"]
          expira_at: string
          id: string
          jugador_id: string
          monto_total: number
          mp_init_point: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          pagado_at: string | null
          token: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "links_pago"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      equipo_desde_origen: {
        Args: {
          p_partido: string
          p_puesto: number
          p_resultado: string
          p_zona: string
        }
        Returns: string
      }
      es_admin: { Args: never; Returns: boolean }
      generar_cuotas_sociales: { Args: { p_periodo?: string }; Returns: number }
      generar_todos_contra_todos: {
        Args: { p_categoria_id: string; p_zona_id?: string }
        Returns: number
      }
      guardar_descansos: {
        Args: { p_descansos: Json; p_partido_id: string }
        Returns: number
      }
      guardar_equipo: {
        Args: {
          p_actividad_id: string
          p_equipo_id?: string
          p_jugadores: string[]
          p_nombre: string
        }
        Returns: string
      }
      guardar_resultado: {
        Args: {
          p_goleadores?: Json
          p_goles_a: number
          p_goles_b: number
          p_goles_chukkers?: Json
          p_partido_id: string
        }
        Returns: undefined
      }
      registrar_devolucion: {
        Args: { p_jugador_id: string; p_medio: Database["public"]["Enums"]["medio_pago"]; p_monto: number; p_nota?: string }
        Returns: string
      }
      registrar_pago: {
        Args: {
          p_cobro_ids: string[]
          p_comprobante_path?: string
          p_fecha?: string
          p_jugador_id: string
          p_medio: Database["public"]["Enums"]["medio_pago"]
          p_monto: number
          p_nota?: string
        }
        Returns: string
      }
      saldo_a_favor: { Args: { p_jugador_id: string }; Returns: number }
      usar_saldo_a_favor: {
        Args: { p_cobro_ids: string[]; p_jugador_id: string; p_monto?: number }
        Returns: number
      }
      hoy_ar: { Args: never; Returns: string }
      monto_cuota_social: { Args: { p_periodo: string }; Returns: number }
      nombre_periodo: { Args: { p_periodo: string }; Returns: string }
      normalizar_texto: { Args: { texto: string }; Returns: string }
      pago_publico: { Args: { p_token: string }; Returns: Json }
      procesar_vencimientos: { Args: never; Returns: Json }
      registrar_pago_mp: {
        Args: {
          p_link_id: string
          p_monto: number
          p_payload: Json
          p_payment_id: string
          p_status: string
        }
        Returns: string
      }
      zona_terminada: { Args: { p_zona_id: string }; Returns: boolean }
    }
    Enums: {
      asistencia: "presente" | "ausente"
      concepto_cobro: "cuota_social" | "practica" | "clase" | "torneo" | "otro"
      estado_actividad: "programada" | "finalizada" | "cancelada"
      estado_cobro:
        | "pendiente"
        | "pagado"
        | "vencido"
        | "anulado"
        | "bonificado"
      estado_link: "activo" | "pagado" | "vencido" | "anulado"
      estado_partido: "programado" | "jugado" | "suspendido"
      fase_partido: "grupos" | "cuartos" | "semi" | "final" | "otro"
      mano: "diestro" | "zurdo"
      medio_pago: "mercadopago" | "efectivo" | "transferencia"
      tipo_actividad: "practica" | "clase" | "torneo"
      tipo_documento: "apto_medico" | "seguro" | "deslinde" | "otro"
      tipo_evento_cobro:
        | "creado"
        | "link_generado"
        | "enviado"
        | "pagado"
        | "vencido"
        | "anulado"
        | "bonificado"
        | "reactivado"
        | "monto_modificado"
        | "link_invalidado"
        | "pago_a_revisar"
        | "pago_parcial"
        | "pago_anulado"
      tipo_jugador: "socio" | "no_socio" | "alumno" | "externo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asistencia: ["presente", "ausente"],
      concepto_cobro: ["cuota_social", "practica", "clase", "torneo", "otro"],
      estado_actividad: ["programada", "finalizada", "cancelada"],
      estado_cobro: ["pendiente", "pagado", "vencido", "anulado", "bonificado"],
      estado_link: ["activo", "pagado", "vencido", "anulado"],
      estado_partido: ["programado", "jugado", "suspendido"],
      fase_partido: ["grupos", "cuartos", "semi", "final", "otro"],
      mano: ["diestro", "zurdo"],
      medio_pago: ["mercadopago", "efectivo", "transferencia"],
      tipo_actividad: ["practica", "clase", "torneo"],
      tipo_documento: ["apto_medico", "seguro", "deslinde", "otro"],
      tipo_evento_cobro: [
        "creado",
        "link_generado",
        "enviado",
        "pagado",
        "vencido",
        "anulado",
        "bonificado",
        "reactivado",
        "monto_modificado",
        "link_invalidado",
        "pago_a_revisar",
        "pago_parcial",
        "pago_anulado",
      ],
      tipo_jugador: ["socio", "no_socio", "alumno", "externo"],
    },
  },
} as const
