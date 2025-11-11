import java.time.LocalDateTime;

public class CounterAssignment {
    private String id;
    private String counterId;
    private String receptionistId;
    private LocalDateTime assignedAt;
    private LocalDateTime completedAt;
    private String status;
    private String notes;
    
    // Quan hệ nhiều-một
    private Counter counter;
    private Receptionist receptionist;
    
    public CounterAssignment() {
    }
}

