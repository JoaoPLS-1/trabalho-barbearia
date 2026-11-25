import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientesService } from './clientes.service.js';
import { CreateClienteDto } from './dto/create-cliente.dto.js';
import { UpdateClienteDto } from './dto/update-cliente.dto.js';
import { EmpresaId } from '../common/empresa-id.decorator.js';
import { PositiveIdPipe } from '../common/positive-id.pipe.js';
import { ListQueryDto } from '../common/list-query.dto.js';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Post()
  create(@EmpresaId() empresaId: number, @Body() dto: CreateClienteDto) {
    return this.service.create(empresaId, dto);
  }

  @Get()
  findAll(@EmpresaId() empresaId: number, @Query() query: ListQueryDto) {
    return this.service.findAll(empresaId, query);
  }

  @Get(':id')
  findOne(
    @EmpresaId() empresaId: number,
    @Param('id', PositiveIdPipe) id: number,
  ) {
    return this.service.findOne({ id, empresaId });
  }

  @Patch(':id')
  update(
    @EmpresaId() empresaId: number,
    @Param('id', PositiveIdPipe) id: number,
    @Body() dto: UpdateClienteDto,
  ) {
    return this.service.update({ id, empresaId, clienteData: dto });
  }

  @Delete(':id')
  remove(
    @EmpresaId() empresaId: number,
    @Param('id', PositiveIdPipe) id: number,
  ) {
    return this.service.remove({ id, empresaId });
  }
}
