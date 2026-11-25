import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { EmpresaId } from '../common/empresa-id.decorator.js';
import { AgendamentosService } from './agendamentos.service.js';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto.js';
import { DisponibilidadeQueryDto } from './dto/agenda-query.dto.js';

@Controller('agendamentos')
export class AgendamentosController {
  constructor(private readonly reservas: AgendamentosService) {}

  @Post()
  async create(
    @EmpresaId() empresaId: number,
    @Body() dto: CreateAgendamentoDto,
    @Headers('idempotency-key') chave: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.reservas.create(empresaId, dto, chave);
    response.status(result.reutilizado ? 200 : 201);
    return result.item;
  }

  @Get('disponibilidade')
  disponibilidade(
    @EmpresaId() empresaId: number,
    @Query() query: DisponibilidadeQueryDto,
  ) {
    return this.reservas.disponibilidade(empresaId, query);
  }
}
