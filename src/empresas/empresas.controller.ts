import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EmpresasService } from './empresas.service.js';
import { CreateEmpresaDto } from './dto/create-empresa.dto.js';
import { UpdateEmpresaDto } from './dto/update-empresa.dto.js';
import { EmpresaQueryDto } from './dto/empresa-query.dto.js';
import { PositiveIdPipe } from '../common/positive-id.pipe.js';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}
  @Post()
  create(@Body() dto: CreateEmpresaDto) {
    return this.empresas.create(dto);
  }
  @Get()
  findAll(@Query() query: EmpresaQueryDto) {
    return this.empresas.findAll(query);
  }
  @Get(':id')
  findOne(@Param('id', PositiveIdPipe) id: number) {
    return this.empresas.findOne(id);
  }
  @Patch(':id')
  update(
    @Param('id', PositiveIdPipe) id: number,
    @Body() dto: UpdateEmpresaDto,
  ) {
    return this.empresas.update(id, dto);
  }
}
