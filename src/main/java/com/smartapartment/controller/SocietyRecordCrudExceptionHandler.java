package com.smartapartment.controller;

import jakarta.persistence.OptimisticLockException;
import jakarta.persistence.PersistenceException;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

@Order(-10)
@RestControllerAdvice(assignableTypes={SocietyRecordCrudController.class,FinanceApiController.class,SocietyApiController.class,OperationsApiController.class})
public class SocietyRecordCrudExceptionHandler {
    @ExceptionHandler({OptimisticLockException.class,ObjectOptimisticLockingFailureException.class})
    ResponseEntity<Map<String,String>> concurrentChange(Exception error){return ResponseEntity.status(409).body(Map.of("message","This record changed. Refresh it before saving or deleting."));}
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    ResponseEntity<Map<String,String>> dependencyConflict(Exception error){return ResponseEntity.status(409).body(Map.of("message","This record is already present or is used by another record. Remove its dependencies before deleting."));}
    @ExceptionHandler(PersistenceException.class)
    ResponseEntity<Map<String,String>> persistence(PersistenceException error){
        for(Throwable cause=error;cause!=null;cause=cause.getCause()){
            if(cause instanceof org.hibernate.exception.ConstraintViolationException)
                return ResponseEntity.status(409).body(Map.of("message","This record is already present or is used by another record. Remove its dependencies before deleting."));
        }
        return ResponseEntity.internalServerError().body(Map.of("message","The record could not be saved. Please retry."));
    }
}
