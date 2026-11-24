import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { VocabularyService } from '../services/vocabulary.service';
import { SearchVocabDto } from '../dto/search-vocab.dto';

@Controller('vocabularies')
export class VocabulariesController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get('search')
  async search(@Query() query: SearchVocabDto) {
    return this.vocabularyService.searchVocabularies(query);
  }

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.vocabularyService.findVocabularyById(id);
  }
}
