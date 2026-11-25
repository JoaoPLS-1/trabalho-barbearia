import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PositiveIdPipe } from '../common/positive-id.pipe.js';
import { EmpresaId } from '../common/empresa-id.decorator.js';
import { AgendamentosService } from './agendamentos.service.js';
import { AgendaLeituraService } from './agenda-leitura.service.js';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto.js';
import {
  AgendaQueryDto,
  DisponibilidadeQueryDto,
  PendentesQueryDto,
} from './dto/agenda-query.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';

@Controller('agendamentos')
export class AgendamentosController {
  constructor(
    private readonly reservas: AgendamentosService,
    private readonly consultas: AgendaLeituraService,
  ) {}

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

  @Get()
  findAll(@EmpresaId() empresaId: number, @Query() query: AgendaQueryDto) {
    return this.consultas.findAll(empresaId, query);
  }

  @Get('pendentes')
  pendentes(@EmpresaId() empresaId: number, @Query() query: PendentesQueryDto) {
    return this.consultas.pendentes(empresaId, query);
  }

  @Get('disponibilidade')
  disponibilidade(
    @EmpresaId() empresaId: number,
    @Query() query: DisponibilidadeQueryDto,
  ) {
    return this.reservas.disponibilidade(empresaId, query);
  }

  @Get('operacoes/:chave')
  operacao(@EmpresaId() empresaId: number, @Param('chave') chave: string) {
    return this.consultas.operacao(empresaId, chave);
  }

  @Get(':id')
  findOne(
    @EmpresaId() empresaId: number,
    @Param('id', PositiveIdPipe) id: number,
  ) {
    return this.consultas.findOne(empresaId, id);
  }

  @Patch(':id/status')
  atualizarStatus(
    @EmpresaId() empresaId: number,
    @Param('id', PositiveIdPipe) id: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.reservas.atualizarStatus(empresaId, id, dto);
  }
}
