import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FlowsRepository } from './repositories/flows.repository';
import { FlowsMapper } from './flows.mapper';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { FlowResponseDto } from './dto/flow-response.dto';
import { FlowDetailResponseDto } from './dto/flow-detail-response.dto';

@Injectable()
export class FlowsService {
  constructor(private readonly flowsRepository: FlowsRepository) {}

  async create(dto: CreateFlowDto): Promise<FlowResponseDto> {
    const existing = await this.flowsRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(`Code "${dto.code}" đã tồn tại`);
    }

    const created = await this.flowsRepository.create(dto);
    const withCount = await this.flowsRepository.findByIdWithCount(created.id);
    return FlowsMapper.toResponseDto(withCount!);
  }

  async findAll(): Promise<FlowResponseDto[]> {
    const flows = await this.flowsRepository.findAll();
    return FlowsMapper.toResponseDtoList(flows);
  }

  async findDetailById(id: number): Promise<FlowDetailResponseDto> {
    const flow = await this.flowsRepository.findByIdWithGraph(id);
    if (!flow) {
      throw new NotFoundException(`Flow #${id} không tồn tại`);
    }
    return FlowsMapper.toDetailResponseDto(flow);
  }

  async update(id: number, dto: UpdateFlowDto): Promise<FlowResponseDto> {
    await this.assertExists(id);

    if (dto.code) {
      const existing = await this.flowsRepository.findByCode(dto.code);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Code "${dto.code}" đã tồn tại`);
      }
    }

    await this.flowsRepository.update(id, dto);
    const updated = await this.flowsRepository.findByIdWithCount(id);
    return FlowsMapper.toResponseDto(updated!);
  }

  async remove(id: number): Promise<void> {
    await this.assertExists(id);
    await this.flowsRepository.softDelete(id);
  }

  /** Dùng nội bộ bởi FlowStepsService/FlowDependenciesService để xác nhận flow tồn tại */
  async assertExists(id: number): Promise<void> {
    const flow = await this.flowsRepository.findById(id);
    if (!flow) {
      throw new NotFoundException(`Flow #${id} không tồn tại`);
    }
  }
}
