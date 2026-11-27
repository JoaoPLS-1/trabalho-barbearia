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
import { ServicosService } from './servicos.service.js';
import { CreateServicoDto } from './dto/create-servico.dto.js';
import { UpdateServicoDto } from './dto/update-servico.dto.js';
import { EmpresaId } from '../common/empresa-id.decorator.js';
import { PositiveIdPipe } from '../common/positive-id.pipe.js';
import { CatalogQueryDto } from '../common/list-query.dto.js';

@Controller('servicos')
export class ServicosController {
  constructor(private readonly service: ServicosService) {}

  @Post()
  create(@EmpresaId() empresaId: number, @Body() dto: CreateServicoDto) {
    return this.service.create(empresaId, dto);
  }

  @Get()
  findAll(@EmpresaId() empresaId: number, @Query() query: CatalogQueryDto) {
    return this.service.findAll(empresaId, query);
  }

  @Get(':id')
  findOne(
    @EmpresaId() empresaId: number,
    @Param('id', PositiveIdPipe) id: number,
  ) {
    return this.service.findOne(empresaId, id);
  }

  @Patch(':id')
  update(
    @EmpresaId() empresaId: number,
    @Param('id', PositiveIdPipe) id: number,
    @Body() dto: UpdateServicoDto,
  ) {
    return this.service.update(empresaId, id, dto);
  }

  @Delete(':id')
  remove(
    @EmpresaId() empresaId: number,
    @Param('id', PositiveIdPipe) id: number,
  ) {
    return this.service.remove(empresaId, id);
  }
}
