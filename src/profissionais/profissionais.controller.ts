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
import { ProfissionaisService } from './profissionais.service.js';
import { CreateProfissionaisDto } from './dto/create-profissional.dto.js';
import { UpdateProfissionaisDto } from './dto/update-profissional.dto.js';
import { EmpresaId } from '../common/empresa-id.decorator.js';
import { PositiveIdPipe } from '../common/positive-id.pipe.js';
import { CatalogQueryDto } from '../common/list-query.dto.js';

@Controller('profissionais')
export class ProfissionaisController {
  constructor(private readonly service: ProfissionaisService) {}

  @Post()
  create(@EmpresaId() empresaId: number, @Body() dto: CreateProfissionaisDto) {
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
    @Body() dto: UpdateProfissionaisDto,
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
